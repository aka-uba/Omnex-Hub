# ========================================
# Omnex Display Hub - Production Dockerfile
# PHP 8.4 + Apache + PostgreSQL extensions
# ========================================

FROM php:8.4-apache

LABEL maintainer="aka-uba <ugurbakagunduz@gmail.com>"
LABEL description="Omnex Display Hub - ESL & Digital Signage Platform"

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libzip-dev \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    ffmpeg \
    mosquitto-clients \
    cron \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
    pdo_pgsql \
    pgsql \
    zip \
    opcache \
    gd

# Enable Apache modules
RUN a2enmod rewrite headers expires deflate ssl

# Configure OPcache for production
RUN { \
    echo 'opcache.memory_consumption=128'; \
    echo 'opcache.interned_strings_buffer=8'; \
    echo 'opcache.max_accelerated_files=10000'; \
    echo 'opcache.revalidate_freq=0'; \
    echo 'opcache.validate_timestamps=0'; \
    echo 'opcache.save_comments=1'; \
    echo 'opcache.enable_cli=0'; \
    echo 'opcache.enable=1'; \
} > /usr/local/etc/php/conf.d/opcache.ini

# PHP production configuration
RUN { \
    echo 'display_errors=Off'; \
    echo 'log_errors=On'; \
    echo 'error_log=/var/log/php_errors.log'; \
    echo 'upload_max_filesize=50M'; \
    echo 'post_max_size=55M'; \
    echo 'memory_limit=256M'; \
    echo 'max_execution_time=120'; \
    echo 'date.timezone=Europe/Istanbul'; \
    echo 'expose_php=Off'; \
} > /usr/local/etc/php/conf.d/production.ini

# Apache configuration - DocumentRoot at project root (like XAMPP)
# Root .htaccess handles all routing (API, SPA, static files)
RUN { \
    echo '<VirtualHost *:80>'; \
    echo '    DocumentRoot /var/www/html'; \
    echo '    <Directory /var/www/html>'; \
    echo '        AllowOverride All'; \
    echo '        Require all granted'; \
    echo '    </Directory>'; \
    echo '    ErrorLog ${APACHE_LOG_DIR}/error.log'; \
    echo '    CustomLog ${APACHE_LOG_DIR}/access.log combined'; \
    echo '</VirtualHost>'; \
} > /etc/apache2/sites-available/000-default.conf

# Set ServerName to suppress warning
RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf

# Set working directory
WORKDIR /var/www/html

# Copy application files (only necessary directories)
COPY api/ ./api/
COPY core/ ./core/
COPY middleware/ ./middleware/
COPY services/ ./services/
COPY public/ ./public/
COPY locales/ ./locales/
COPY parsers/ ./parsers/
COPY mappings/ ./mappings/
COPY workers/ ./workers/
COPY cron/ ./cron/
COPY database/postgresql/ ./database/postgresql/
COPY database/seeds/ ./database/seeds/
COPY database/seeders/ ./database/seeders/
COPY tools/postgresql/ ./tools/postgresql/
COPY web-build/ ./web-build/
COPY deploy/scripts/docker-app-entrypoint.sh /usr/local/bin/omnex-app-entrypoint
COPY config.php ./
COPY index.php ./
COPY .htaccess ./

# Create required directories
RUN mkdir -p storage/cache storage/companies storage/avatars storage/renders \
    storage/exports storage/logs storage/media storage/templates/portrait \
    storage/templates/landscape storage/public/samples

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod -R 775 /var/www/html/storage \
    && chmod +x /usr/local/bin/omnex-app-entrypoint

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:80/api/health || exit 1

CMD ["/usr/local/bin/omnex-app-entrypoint"]
