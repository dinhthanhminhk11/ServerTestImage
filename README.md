# HLS Video Origin Server

Server nay nhan video upload qua API, tu transcode sang HLS nhieu chat luong, roi publish ra origin path co cache header dai de dat sau Nginx hoac Cloudflare.

## Cau truc MVC

```text
src/
  app.js
  config/
    appConfig.js
  controllers/
    systemController.js
    videoController.js
  middlewares/
    asyncHandler.js
    corsMiddleware.js
    errorHandler.js
    uploadVideoMiddleware.js
  models/
    videoModel.js
  routes/
    index.js
    systemRoutes.js
    videoRoutes.js
  services/
    transcodeService.js
    videoQueueService.js
    videoService.js
  utils/
    httpError.js
```

## Luong xu ly

1. Frontend hoac backend goi `POST /api/videos/upload`.
2. Middleware upload nhan file multipart.
3. Controller goi `videoService`.
4. Model luu metadata va source file vao `storage/`.
5. Queue service day job qua `transcodeService`.
6. `ffmpeg` tao HLS renditions trong `storage/videos/<videoId>/`.
7. Client phat bang `master.m3u8` qua route `/cdn/videos/...`.

## API chinh

- `POST /api/videos/upload`
  - Content-Type: `multipart/form-data`
  - field file: `video`
  - field text tuy chon: `title`
- `GET /api/videos`
- `GET /api/videos/:videoId`
- `GET /api/videos/:videoId/status`
- `POST /api/videos/:videoId/retry`

## Chay local

```bash
npm install
npm run dev
```

Server mac dinh chay o `http://localhost:3000`.

## Test upload

```bash
curl -X POST http://localhost:3000/api/videos/upload \
  -F "title=Demo video" \
  -F "video=@sample.mp4"
```

Khi transcode xong, response tu `GET /api/videos/:videoId` se co:

- `playback.masterPlaylistUrl`
- `playback.highestPlaylistUrl`
- `playback.sourcePlaylistUrl`
- danh sach `renditions`

## Cache

Route `/cdn/videos/*` duoc set:

- `Cache-Control: public, max-age=31536000, immutable`
- `ETag`
- `Last-Modified`
- `Access-Control-Allow-Origin`

Vi HLS VOD chi publish sau khi encode xong nen playlist va segment co the cache dai han an toan.

## Chat luong video

Mac dinh server sinh adaptive bitrate ladder:

- 2160p
- 1440p
- 1080p
- 720p
- 480p
- 360p
- 240p

Server tu bo qua cac muc cao hon source, nen se khong upscale video nho.

Ngoai cac preset, server luon tao them 1 rendition `source` giu nguyen kich thuoc goc cua file upload.

Voi video doc, server dung ladder rieng:

- `1080x1920`
- `720x1280`
- `540x960`
- `360x640`
- `source`

## Production

- Dung file mau `deploy/nginx-hls.conf`.
- Neu co domain CDN rieng, set `PUBLIC_PLAYBACK_BASE_URL=https://cdn.example.com/cdn/videos`.
- Neu luong video lon, nen chuyen `storage/videos` sang object storage nhu S3 hoac Cloudflare R2 va de Node chi lam upload + transcode + metadata.
- `TRANSCODE_CONCURRENCY=1` la an toan cho may nho. Tang so nay chi khi CPU du manh.
