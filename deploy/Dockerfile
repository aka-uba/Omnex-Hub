# ========================================
# Omnex Display Hub - Production Dockerfile
# PHP 8.4 + Apache + PostgreSQL extensions
# ========================================

FROM php:8.4-apache

LABEL maintainer="aka-uba <ugurbakagunduz@gmail.com>"
LABEL description="Omnex Display Hub - ESL & Digital Signage Platform"

# Install system dependencies + UTF-8 locale for Turkish filenames
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
    locales \
    && sed -i 's/# en_US.UTF-8/en_US.UTF-8/' /etc/locale.gen \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

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

# Configure OPcache for production (optimized for multi-tenant workload)
RUN { \
    echo 'opcache.memory_consumption=192'; \
    echo 'opcache.interned_strings_buffer=16'; \
    echo 'opcache.max_accelerated_files=10000'; \
    echo 'opcache.revalidate_freq=0'; \
    echo 'opcache.validate_timestamps=0'; \
    echo 'opcache.save_comments=1'; \
    echo 'opcache.enable_cli=0'; \
    echo 'opcache.enable=1'; \
    echo 'opcache.enable_file_override=1'; \
    echo 'opcache.jit=tracing'; \
    echo 'opcache.jit_buffer_size=64M'; \
} > /usr/local/etc/php/conf.d/opcache.ini

# PHP production configuration (optimized for multi-tenant workload)
RUN { \
    echo 'display_errors=Off'; \
    echo 'log_errors=On'; \
    echo 'error_log=/var/log/php_errors.log'; \
    echo 'upload_max_filesize=50M'; \
    echo 'post_max_size=55M'; \
    echo 'memory_limit=256M'; \
    echo 'max_execution_time=120'; \
    echo 'max_input_vars=3000'; \
    echo 'date.timezone=Europe/Istanbul'; \
    echo 'expose_php=Off'; \
    echo 'realpath_cache_size=4096K'; \
    echo 'realpath_cache_ttl=600'; \
    echo 'session.cookie_httponly=1'; \
    echo 'session.cookie_secure=1'; \
    echo 'session.use_strict_mode=1'; \
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
COPY downloads/ ./downloads/
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
