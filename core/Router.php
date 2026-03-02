<?php
/**
 * Router - URL Routing Handler
 *
 * @package OmnexDisplayHub
 */

class Router
{
    private array $routes = [];
    private array $middleware = [];
    private string $prefix = '';
    private array $currentMiddleware = [];

    /**
     * Add GET route
     */
    public function get(string $path, callable|array $handler): self
    {
        return $this->addRoute('GET', $path, $handler);
    }

    /**
     * Add POST route
     */
    public function post(string $path, callable|array $handler): self
    {
        return $this->addRoute('POST', $path, $handler);
    }

    /**
     * Add PUT route
     */
    public function put(string $path, callable|array $handler): self
    {
        return $this->addRoute('PUT', $path, $handler);
    }

    /**
     * Add DELETE route
     */
    public function delete(string $path, callable|array $handler): self
    {
        return $this->addRoute('DELETE', $path, $handler);
    }

    /**
     * Add PATCH route
     */
    public function patch(string $path, callable|array $handler): self
    {
        return $this->addRoute('PATCH', $path, $handler);
    }

    /**
     * Add route for multiple methods
     */
    public function match(array $methods, string $path, callable|array $handler): self
    {
        foreach ($methods as $method) {
            $this->addRoute(strtoupper($method), $path, $handler);
        }
        return $this;
    }

    /**
     * Add route for all methods
     */
    public function any(string $path, callable|array $handler): self
    {
        return $this->match(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], $path, $handler);
    }

    /**
     * Group routes with prefix and/or middleware
     */
    public function group(array $options, callable $callback): self
    {
        $previousPrefix = $this->prefix;
        $previousMiddleware = $this->currentMiddleware;

        if (isset($options['prefix'])) {
            $this->prefix .= '/' . trim($options['prefix'], '/');
        }

        if (isset($options['middleware'])) {
            $middleware = is_array($options['middleware'])
                ? $options['middleware']
                : [$options['middleware']];
            $this->currentMiddleware = array_merge($this->currentMiddleware, $middleware);
        }

        $callback($this);

        $this->prefix = $previousPrefix;
        $this->currentMiddleware = $previousMiddleware;

        return $this;
    }

    /**
     * Register middleware
     */
    public function registerMiddleware(string $name, string $class): self
    {
        $this->middleware[$name] = $class;
        return $this;
    }

    /**
     * Handle the request
     */
    public function dispatch(Request $request): void
    {
        $method = $request->getMethod();
        $path = $request->getPath();

        // Handle OPTIONS preflight
        if ($method === 'OPTIONS') {
            Response::preflight();
        }

        // HEAD requests should match GET routes (HTTP spec compliance)
        $matchMethod = ($method === 'HEAD') ? 'GET' : $method;

        // Find matching route
        foreach ($this->routes as $route) {
            if ($route['method'] !== $matchMethod && $route['method'] !== $method) {
                continue;
            }

            $params = $this->matchPath($route['pattern'], $path);
            if ($params !== false) {
                // Set route params
                foreach ($params as $key => $value) {
                    $request->setRouteParam($key, $value);
                }

                // Run middleware chain
                $this->runMiddleware($route['middleware'], $request, function () use ($route, $request) {
                    $this->callHandler($route['handler'], $request);
                });

                return;
            }
        }

        // No route found
        Response::notFound('Route not found: ' . $path);
    }

    /**
     * Add route to collection
     */
    private function addRoute(string $method, string $path, callable|array $handler): self
    {
        $fullPath = $this->prefix . '/' . trim($path, '/');
        $fullPath = '/' . trim($fullPath, '/');

        $this->routes[] = [
            'method' => $method,
            'path' => $fullPath,
            'pattern' => $this->pathToPattern($fullPath),
            'handler' => $handler,
            'middleware' => $this->currentMiddleware
        ];

        return $this;
    }

    /**
     * Convert path to regex pattern
     */
    private function pathToPattern(string $path): string
    {
        // Escape regex special chars EXCEPT curly braces (used for placeholders)
        $pattern = preg_replace('/[.+^$()[\]|\\\\]/', '\\\\$0', $path);

        // Convert {param} to named capture group
        $pattern = preg_replace('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', '(?P<$1>[^/]+)', $pattern);

        // Convert {param?} to optional named capture group
        $pattern = preg_replace('/\{([a-zA-Z_][a-zA-Z0-9_]*)\?\}/', '(?P<$1>[^/]*)?', $pattern);

        return '#^' . $pattern . '$#';
    }

    /**
     * Match path against pattern
     */
    private function matchPath(string $pattern, string $path): array|false
    {
        if (preg_match($pattern, $path, $matches)) {
            // Filter out numeric keys
            return array_filter($matches, fn($key) => is_string($key), ARRAY_FILTER_USE_KEY);
        }
        return false;
    }

    /**
     * Run middleware chain
     */
    private function runMiddleware(array $middlewareNames, Request $request, callable $final): void
    {
        if (empty($middlewareNames)) {
            $final();
            return;
        }

        $middleware = array_shift($middlewareNames);

        // Resolve middleware class
        if (isset($this->middleware[$middleware])) {
            $class = $this->middleware[$middleware];
        } else {
            $class = $middleware;
        }

        if (!class_exists($class)) {
            throw new Exception("Middleware not found: $class");
        }

        $instance = new $class();

        if (!method_exists($instance, 'handle')) {
            throw new Exception("Middleware must have handle method: $class");
        }

        $instance->handle($request, function () use ($middlewareNames, $request, $final) {
            $this->runMiddleware($middlewareNames, $request, $final);
        });
    }

    /**
     * Call route handler
     */
    private function callHandler(callable|array $handler, Request $request): void
    {
        if (is_array($handler)) {
            [$class, $method] = $handler;

            if (!class_exists($class)) {
                throw new Exception("Controller not found: $class");
            }

            $instance = new $class();

            if (!method_exists($instance, $method)) {
                throw new Exception("Method not found: $class::$method");
            }

            $instance->$method($request);
        } else {
            $handler($request);
        }
    }
}
