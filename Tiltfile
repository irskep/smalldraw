watch_settings(ignore=["node_modules", "dist", ".git", "sqlite", "coverage"])

def local_dev_server(name, serve_cmd, deps, port, resource_deps=[]):
    local_resource(
        name,
        serve_cmd=serve_cmd,
        deps=deps,
        resource_deps=resource_deps,
        allow_parallel=True,
        readiness_probe=probe(
            period_secs=2,
            timeout_secs=2,
            tcp_socket=tcp_socket_action(port=port),
        ),
    )

local_resource(
    "app-server",
    serve_cmd="mise run server:dev",
    deps=[
        "apps/server/src",
        "apps/server/package.json",
        "apps/server/docs",
        "packages/splat/src",
        "scripts/derive-frontend-origins.sh",
        "mise.toml",
        ".env",
    ],
    allow_parallel=True,
    readiness_probe=probe(
        period_secs=2,
        timeout_secs=2,
        tcp_socket=tcp_socket_action(port=3030),
    ),
)

local_dev_server(
    "splat-web",
    "mise run splat:web:dev",
    deps=[
        "apps/splat-web/src",
        "apps/splat-web/package.json",
        "packages/splat/src",
        "packages/core/src",
        "packages/geometry/src",
        "packages/renderer-canvas/src",
        "packages/renderer-raster/src",
        "mise.toml",
    ],
    port=3000,
    resource_deps=["app-server"],
)

local_dev_server(
    "app-frontend",
    "mise run account:web:dev",
    deps=[
        "apps/app/src",
        "apps/app/package.json",
        "apps/app/vite.config.ts",
        "mise.toml",
    ],
    port=3001,
    resource_deps=["app-server"],
)

local_dev_server(
    "design-system",
    "mise run design-system:dev",
    deps=[
        "packages/design-system/src",
        "packages/design-system/harness",
        "packages/design-system/package.json",
        "packages/design-system/playwright.config.ts",
        "mise.toml",
    ],
    port=3002,
)
