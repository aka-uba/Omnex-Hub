/*
Copyright 2017 Ziadin Givan

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

https://github.com/givanz/Vvvebjs
*/

Vvveb.Gui.download =
function () {
    let assets = [];
    let cssAssets = []; // CSS files that need to be parsed for fonts

    function addUrl(url, href, binary, isCss = false) {
        // Avoid duplicates
        if (assets.find(a => a.href === href)) return;
        const asset = {url, href, binary};
        assets.push(asset);
        if (isCss) {
            cssAssets.push(asset);
        }
    }

    let html = Vvveb.Builder.frameHtml;

    //stylesheets (exclude editor helper styles)
    html.querySelectorAll("link[href$='.css']").forEach(function(e, i) {
        // Skip editor helper stylesheets
        if (e.hasAttribute('data-vvveb-helpers')) return;
        const href = e.getAttribute("href");
        if (href) addUrl(e.href, href, false, true);
    });

    //javascripts
    html.querySelectorAll("script[src$='.js']").forEach(function(e, i) {
        const src = e.getAttribute("src");
        if (src) addUrl(e.src, src, false);
    });

    //images
    html.querySelectorAll("img[src]").forEach(function(e, i) {
        const src = e.getAttribute("src");
        // Skip base64 data URLs
        if (src && !src.startsWith('data:')) {
            addUrl(e.src, src, true);
        }
    });

    // background images in inline styles
    html.querySelectorAll('[style*="url("]').forEach(function(e, i) {
        const style = e.getAttribute('style');
        const urlMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
        if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('data:')) {
            addUrl(urlMatch[1], urlMatch[1], true);
        }
    });

    /**
     * Extract URLs from CSS content (fonts, images, etc.)
     * @param {string} cssContent - CSS file content
     * @param {string} cssBaseUrl - Base URL of the CSS file for resolving relative paths
     * @returns {Array} Array of {url, href, binary} objects
     */
    function extractUrlsFromCss(cssContent, cssBaseUrl) {
        const urls = [];
        // Match all url() references in CSS
        const urlRegex = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
        let match;

        while ((match = urlRegex.exec(cssContent)) !== null) {
            let urlPath = match[1].trim();

            // Skip data URLs and absolute URLs to external domains
            if (urlPath.startsWith('data:')) continue;
            if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) continue;

            // Resolve relative path based on CSS file location
            let resolvedUrl;
            try {
                // Get CSS file's directory
                const cssDir = cssBaseUrl.substring(0, cssBaseUrl.lastIndexOf('/') + 1);
                resolvedUrl = new URL(urlPath, cssDir).href;
            } catch (e) {
                console.warn('Could not resolve URL:', urlPath, e);
                continue;
            }

            // Determine if binary (fonts, images)
            const isBinary = /\.(woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp)$/i.test(urlPath);

            urls.push({
                url: resolvedUrl,
                href: urlPath,
                binary: isBinary,
                originalMatch: match[0],
                cssBaseUrl: cssBaseUrl
            });
        }

        return urls;
    }

    let zip = new JSZip();
    let cssContents = {}; // Store CSS contents for later modification

    // First pass: fetch all initially collected assets
    let initialPromises = [];

    for (let i in assets) {
        let asset = assets[i];
        let url = asset.url;
        let href = asset.href;
        let binary = asset.binary;

        let filename = href.substring(href.lastIndexOf('/')+1);
        let path = href.substring(0, href.lastIndexOf('/')).replace(/\.\.\//g, "");
        if (href.indexOf("://") > 0) {
            //ignore path for external assets
            path = "";
        }

        initialPromises.push(new Promise((resolve, reject) => {
            let request = new XMLHttpRequest();
            request.open('GET', url);
            if (binary) {
                request.responseType = 'blob';
            } else {
                request.responseType = 'text';
            }

            request.onload = function() {
                if (request.status === 200) {
                    resolve({url, href, filename, path, binary, data:request.response, status:request.status});
                } else {
                    console.error('Error code:' + request.statusText);
                    resolve({status:request.status});
                }
            };

            request.onerror = function() {
                reject(Error('There was a network error.'));
            };

            try {
                request.send();
            } catch (error) {
                console.error(error);
                resolve({status: 0});
            }
        }));
    }

    Promise.all(initialPromises).then((initialData) => {
        // Find additional assets from CSS files (fonts, background images)
        let additionalAssets = [];

        for (let file of initialData) {
            if (file.status === 200 && !file.binary && file.href.endsWith('.css')) {
                // Store CSS content for later modification
                cssContents[file.href] = file.data;

                // Extract URLs from CSS
                const cssUrls = extractUrlsFromCss(file.data, file.url);
                for (let cssUrl of cssUrls) {
                    // Check if not already in assets
                    if (!assets.find(a => a.url === cssUrl.url) &&
                        !additionalAssets.find(a => a.url === cssUrl.url)) {
                        additionalAssets.push(cssUrl);
                    }
                }
            }
        }

        // Fetch additional assets (fonts, etc.)
        let additionalPromises = [];

        for (let asset of additionalAssets) {
            additionalPromises.push(new Promise((resolve, reject) => {
                let request = new XMLHttpRequest();
                request.open('GET', asset.url);
                if (asset.binary) {
                    request.responseType = 'blob';
                } else {
                    request.responseType = 'text';
                }

                request.onload = function() {
                    if (request.status === 200) {
                        // Calculate path relative to CSS file
                        let filename = asset.href.substring(asset.href.lastIndexOf('/') + 1);
                        let relativePath = asset.href.substring(0, asset.href.lastIndexOf('/'));

                        // Get CSS file's path in the zip
                        const cssHref = asset.cssBaseUrl.split('/').slice(-3).join('/'); // Get last 3 parts
                        const cssPath = cssHref.substring(0, cssHref.lastIndexOf('/'));

                        // Resolve the path
                        let resolvedPath = '';
                        if (relativePath.startsWith('../')) {
                            // Go up from CSS directory
                            let cssPathParts = cssPath.split('/').filter(p => p);
                            let relPathParts = relativePath.split('/');

                            for (let part of relPathParts) {
                                if (part === '..') {
                                    cssPathParts.pop();
                                } else if (part !== '.') {
                                    cssPathParts.push(part);
                                }
                            }
                            resolvedPath = cssPathParts.join('/');
                        } else {
                            resolvedPath = relativePath.replace(/^\.\//, '');
                        }

                        resolve({
                            url: asset.url,
                            href: asset.href,
                            filename: filename,
                            path: resolvedPath,
                            binary: asset.binary,
                            data: request.response,
                            status: request.status,
                            isFromCss: true,
                            cssHref: cssHref
                        });
                    } else {
                        console.warn('Failed to fetch:', asset.url, request.status);
                        resolve({status: request.status});
                    }
                };

                request.onerror = function() {
                    console.warn('Network error fetching:', asset.url);
                    resolve({status: 0});
                };

                try {
                    request.send();
                } catch (error) {
                    console.error(error);
                    resolve({status: 0});
                }
            }));
        }

        return Promise.all(additionalPromises).then(additionalData => {
            return {initialData, additionalData};
        });

    }).then(({initialData, additionalData}) => {
        let htmlContent = Vvveb.Builder.getHtml();

        // Process initial assets (CSS, JS, images from HTML)
        for (let file of initialData) {
            if (file.status === 200) {
                let folder = zip;

                if (file.path) {
                    file.path = file.path.replace(/^\//, "");
                    folder = zip.folder(file.path);
                }

                let url = (file.path ? file.path + "/" : "") + file.filename.trim().replace(/^\//, "");
                htmlContent = htmlContent.replace(file.href, url);

                // For CSS files, we'll add modified content later
                if (!file.href.endsWith('.css')) {
                    folder.file(file.filename, file.data, {base64: file.binary});
                }
            }
        }

        // Process additional assets (fonts, images from CSS)
        for (let file of additionalData) {
            if (file.status === 200) {
                let folder = zip;

                if (file.path) {
                    file.path = file.path.replace(/^\//, "");
                    folder = zip.folder(file.path);
                }

                folder.file(file.filename, file.data, {base64: file.binary});
            }
        }

        // Add CSS files (content unchanged, paths are already relative)
        for (let file of initialData) {
            if (file.status === 200 && file.href.endsWith('.css')) {
                let folder = zip;

                if (file.path) {
                    file.path = file.path.replace(/^\//, "");
                    folder = zip.folder(file.path);
                }

                // Use original CSS content (relative paths should work as-is)
                folder.file(file.filename, file.data, {base64: false});
            }
        }

        // Add main HTML file
        zip.file(Vvveb.FileManager.getCurrentFileName() ?? "index.html", htmlContent);

        // Generate and download zip
        zip.generateAsync({type:"blob"}).then(function(content) {
            saveAs(content, Vvveb.FileManager.getPageData("title") ?? Vvveb.FileManager.getCurrentPage());
        });

    }).catch((error) => {
        console.error('Download error:', error);
    });
};
