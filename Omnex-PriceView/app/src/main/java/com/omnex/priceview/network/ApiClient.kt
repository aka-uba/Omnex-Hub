package com.omnex.priceview.network

import android.util.Log
import com.omnex.priceview.settings.PriceViewConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import javax.net.ssl.HttpsURLConnection

/**
 * HTTP client for PriceView API communication.
 * Uses device token auth via X-DEVICE-TOKEN header.
 * No external HTTP library dependency (uses HttpURLConnection).
 */
class ApiClient(private val config: PriceViewConfig) {

    companion object {
        private const val TAG = "PriceViewApi"
        private const val CONNECT_TIMEOUT = 10_000  // 10s
        private const val READ_TIMEOUT = 30_000     // 30s (sync can be large)
        private const val SYNC_READ_TIMEOUT = 120_000 // 2min for full sync
    }

    /**
     * Base URL derived from server URL (strips /player/ suffix).
     * e.g. "https://hub.omnexcore.com/player/" -> "https://hub.omnexcore.com"
     */
    private val baseUrl: String
        get() {
            val serverUrl = config.serverUrl ?: "https://hub.omnexcore.com/player/"
            // Strip /player/ or /player suffix to get base API URL
            return serverUrl
                .trimEnd('/')
                .replace(Regex("/player/?$"), "")
                .trimEnd('/')
        }

    // === GET Requests ===

    fun get(path: String, params: Map<String, String> = emptyMap()): ApiResponse {
        val queryString = if (params.isNotEmpty()) {
            "?" + params.entries.joinToString("&") { "${it.key}=${java.net.URLEncoder.encode(it.value, "UTF-8")}" }
        } else ""

        val url = "$baseUrl$path$queryString"
        return request("GET", url)
    }

    /** GET with extended timeout for sync operations */
    fun getSync(path: String, params: Map<String, String> = emptyMap()): ApiResponse {
        val queryString = if (params.isNotEmpty()) {
            "?" + params.entries.joinToString("&") { "${it.key}=${java.net.URLEncoder.encode(it.value, "UTF-8")}" }
        } else ""

        val url = "$baseUrl$path$queryString"
        return request("GET", url, readTimeout = SYNC_READ_TIMEOUT)
    }

    // === POST Requests ===

    fun post(path: String, body: JSONObject? = null): ApiResponse {
        val url = "$baseUrl$path"
        return request("POST", url, body?.toString())
    }

    // === Core Request ===

    private fun request(
        method: String,
        urlString: String,
        body: String? = null,
        readTimeout: Int = READ_TIMEOUT
    ): ApiResponse {
        var connection: HttpURLConnection? = null
        try {
            val url = URL(urlString)
            connection = url.openConnection() as HttpURLConnection

            connection.requestMethod = method
            connection.connectTimeout = CONNECT_TIMEOUT
            connection.readTimeout = readTimeout
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            connection.setRequestProperty("Accept", "application/json")

            // Device token auth
            val token = config.deviceToken
            if (!token.isNullOrBlank()) {
                connection.setRequestProperty("X-DEVICE-TOKEN", token)
            }

            // Send body for POST/PUT
            if (body != null && (method == "POST" || method == "PUT")) {
                connection.doOutput = true
                OutputStreamWriter(connection.outputStream, "UTF-8").use { writer ->
                    writer.write(body)
                    writer.flush()
                }
            }

            val responseCode = connection.responseCode
            val responseBody = try {
                val stream = if (responseCode in 200..299) {
                    connection.inputStream
                } else {
                    connection.errorStream ?: connection.inputStream
                }
                BufferedReader(InputStreamReader(stream, "UTF-8")).use { it.readText() }
            } catch (e: Exception) {
                ""
            }

            Log.d(TAG, "$method $urlString -> $responseCode (${responseBody.length} bytes)")

            return ApiResponse(
                statusCode = responseCode,
                body = responseBody,
                success = responseCode in 200..299
            )
        } catch (e: java.net.SocketTimeoutException) {
            Log.w(TAG, "$method $urlString -> TIMEOUT", e)
            return ApiResponse(statusCode = -1, body = "", success = false, error = "Connection timeout")
        } catch (e: java.net.UnknownHostException) {
            Log.w(TAG, "$method $urlString -> NO NETWORK", e)
            return ApiResponse(statusCode = -2, body = "", success = false, error = "No network connection")
        } catch (e: Exception) {
            Log.e(TAG, "$method $urlString -> ERROR", e)
            return ApiResponse(statusCode = -3, body = "", success = false, error = e.message ?: "Unknown error")
        } finally {
            connection?.disconnect()
        }
    }

    // === HTML Request (for print) ===

    fun getHtml(path: String, body: JSONObject? = null): ApiResponse {
        val url = "$baseUrl$path"
        var connection: HttpURLConnection? = null
        try {
            connection = URL(url).openConnection() as HttpURLConnection
            connection.requestMethod = if (body != null) "POST" else "GET"
            connection.connectTimeout = CONNECT_TIMEOUT
            connection.readTimeout = READ_TIMEOUT
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            connection.setRequestProperty("Accept", "text/html")

            val token = config.deviceToken
            if (!token.isNullOrBlank()) {
                connection.setRequestProperty("X-DEVICE-TOKEN", token)
            }

            if (body != null) {
                connection.doOutput = true
                OutputStreamWriter(connection.outputStream, "UTF-8").use { writer ->
                    writer.write(body.toString())
                    writer.flush()
                }
            }

            val responseCode = connection.responseCode
            val responseBody = try {
                val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
                BufferedReader(InputStreamReader(stream, "UTF-8")).use { it.readText() }
            } catch (e: Exception) { "" }

            return ApiResponse(
                statusCode = responseCode,
                body = responseBody,
                success = responseCode in 200..299
            )
        } catch (e: Exception) {
            Log.e(TAG, "HTML request error: $url", e)
            return ApiResponse(statusCode = -3, body = "", success = false, error = e.message)
        } finally {
            connection?.disconnect()
        }
    }
}

/**
 * API response wrapper
 */
data class ApiResponse(
    val statusCode: Int,
    val body: String,
    val success: Boolean,
    val error: String? = null
) {
    fun toJson(): JSONObject? {
        return try {
            val json = JSONObject(body)
            if (json.has("data")) json.getJSONObject("data") else json
        } catch (e: Exception) { null }
    }

    fun toJsonArray(key: String = "products"): JSONArray {
        return try {
            val json = JSONObject(body)
            val data = if (json.has("data")) json.getJSONObject("data") else json
            data.getJSONArray(key)
        } catch (e: Exception) { JSONArray() }
    }

    fun getDataString(key: String): String? {
        return try {
            val json = JSONObject(body)
            val data = if (json.has("data")) json.getJSONObject("data") else json
            data.optString(key, null)
        } catch (e: Exception) { null }
    }

    fun getDataInt(key: String, default: Int = 0): Int {
        return try {
            val json = JSONObject(body)
            val data = if (json.has("data")) json.getJSONObject("data") else json
            data.optInt(key, default)
        } catch (e: Exception) { default }
    }

    fun getDataBoolean(key: String, default: Boolean = false): Boolean {
        return try {
            val json = JSONObject(body)
            val data = if (json.has("data")) json.getJSONObject("data") else json
            data.optBoolean(key, default)
        } catch (e: Exception) { default }
    }
}
