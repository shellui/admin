#!/usr/bin/env node
/**
 * Simple HTTP server for serving ShellUI SPA builds locally.
 * Serves index.html for all routes to support client-side routing.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const port = process.argv[2] ? parseInt(process.argv[2], 10) : 8000;

const projectRoot = path.resolve(__dirname, '../..');
const distDir = path.join(projectRoot, 'dist');

if (!fs.existsSync(distDir)) {
  console.error(`Error: ${distDir} directory not found!`);
  console.error('Please run "pnpm build" or "shellui build" first.');
  process.exit(1);
}

const indexFile = path.join(distDir, 'index.html');
if (!fs.existsSync(indexFile)) {
  console.error(`Error: ${indexFile} not found!`);
  console.error('Please run "pnpm build" or "shellui build" first.');
  process.exit(1);
}

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.webp': 'image/webp',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function serveFile(filePath, res) {
  const stat = fs.statSync(filePath);

  if (!stat.isFile()) {
    return false;
  }

  const mimeType = getMimeType(filePath);
  const content = fs.readFileSync(filePath);

  res.writeHead(200, {
    'Content-Type': mimeType,
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.end(content);
  return true;
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let requestedPath = parsedUrl.pathname;

  let filePath = path.join(distDir, requestedPath);

  filePath = path.normalize(filePath);

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    if (serveFile(filePath, res)) {
      return;
    }
  }

  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    serveFile(indexPath, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
  console.log(`Serving from: ${distDir}`);
  console.log('Press Ctrl+C to stop the server');
});

process.on('SIGINT', () => {
  console.log('\nServer stopped.');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nServer stopped.');
  server.close(() => {
    process.exit(0);
  });
});
