import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                calibrator: resolve(__dirname, 'calibrator.html'),
                graph: resolve(__dirname, 'graph.html')
            }
        }
    },
    plugins: [
        {
            name: 'rewrite-graph',
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    if (req.url && req.url.startsWith('/graph/')) {
                        req.url = '/graph.html';
                    }
                    next();
                });
            }
        }
    ]
});