<?php
/**
 * Device Adapter Interface
 *
 * Tum cihaz adapter'larinin uygulamasi gereken kontrat.
 * Her yeni cihaz markasi/protokolu icin bu interface implement edilir.
 *
 * @package OmnexDisplayHub\DAL
 */

interface DeviceAdapterInterface
{
    /**
     * Benzersiz adapter tanimlayicisi (orn: 'pavodisplay', 'hanshow', 'kexin')
     */
    public function getAdapterId(): string;

    /**
     * Kullaniciya gorunecek adapter adi (orn: 'PavoDisplay ESL')
     */
    public function getDisplayName(): string;

    /**
     * Cihaz yeteneklerini doner.
     *
     * Anahtarlar:
     *   ping, send_image, send_video, delta_check, reboot,
     *   clear_storage, brightness, led_flash, page_switch,
     *   firmware_update, device_info, bluetooth_provision,
     *   network_config, batch_send, gateway_bridge, playlist_assign
     *
     * @return array<string, bool>
     */
    public function getCapabilities(): array;

    /**
     * Cihazin online olup olmadigini kontrol et.
     *
     * @param array $device  Veritabanindan alinan tam cihaz satiri
     * @return array ['online' => bool, 'response_time' => float|null, 'method' => string, 'error' => string|null]
     */
    public function ping(array $device): array;

    /**
     * Render edilmis icerigi (gorsel) cihaza gonder.
     *
     * @param array  $device    Tam cihaz satiri
     * @param string $imagePath Render edilmis gorselin mutlak dosya yolu
     * @param array  $options   ['width','height','priority','task_config','design_data','product','videos']
     * @return array ['success' => bool, 'error' => string|null, 'skipped' => bool, 'md5' => string|null, 'reason' => string|null]
     */
    public function sendContent(array $device, string $imagePath, array $options = []): array;

    /**
     * Cihaz kontrol komutu calistir.
     *
     * @param array  $device  Tam cihaz satiri
     * @param string $action  Aksiyon adi: refresh, reboot, clear_memory, ping, device_info, set_brightness, led_flash, page_switch, firmware_upgrade
     * @param array  $params  Aksiyona ozel parametreler
     * @return array ['success' => bool, 'message' => string, 'data' => array|null]
     */
    public function control(array $device, string $action, array $params = []): array;

    /**
     * Bu adapter'in destekledigi kontrol aksiyonlarini doner.
     *
     * @return string[] orn: ['refresh', 'reboot', 'clear_memory', 'device_info', 'ping']
     */
    public function getSupportedActions(): array;
}
