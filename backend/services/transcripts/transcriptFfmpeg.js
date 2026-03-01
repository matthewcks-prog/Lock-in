const { spawn, execSync } = require('child_process');
const { logger } = require('../../observability');

// Industry best practice: Use ffmpeg-static for bundled FFmpeg binary
// This eliminates PATH issues across all platforms
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
  logger.info('[Transcripts] Using bundled FFmpeg from ffmpeg-static');
} catch {
  // Fallback to system FFmpeg if ffmpeg-static not installed
  ffmpegPath = 'ffmpeg';
  logger.warn('[Transcripts] ffmpeg-static not found, using system FFmpeg');
}

function checkFfmpegAvailable() {
  try {
    execSync(`"${ffmpegPath}" -version`, { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return false;
  }
}

const FFMPEG_AVAILABLE = checkFfmpegAvailable();
if (!FFMPEG_AVAILABLE) {
  logger.warn(
    '[Transcripts] WARNING: FFmpeg not available. AI transcription will not work.\n' +
      '  The bundled ffmpeg-static should work automatically.\n' +
      '  If issues persist, try: npm install ffmpeg-static (in backend folder)',
  );
} else {
  logger.info('[Transcripts] FFmpeg is available and ready');
}

// Industry best practice: Use MP3 format for Whisper API
// MP3 at 64kbps mono is ~480KB/min vs WAV at ~1.92MB/min (4x smaller)
// OpenAI recommends segments under 25MB, we use 5 minutes (~2.4MB) for reliability
const SEGMENT_DURATION_SECONDS = 300;

function runFfmpeg(args, state) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    state.currentProcess = proc;
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      state.currentProcess = null;
      if (err.code === 'ENOENT') {
        const helpfulError = new Error(
          'FFmpeg not found. Try reinstalling: npm install ffmpeg-static (in backend folder)',
        );
        helpfulError.code = 'FFMPEG_NOT_FOUND';
        reject(helpfulError);
        return;
      }
      reject(err);
    });

    proc.on('close', (code) => {
      state.currentProcess = null;
      if (state.cancelRequested) {
        return reject(new Error('CANCELED'));
      }
      if (code === 0) {
        return resolve();
      }
      const message = stderr.trim() || `ffmpeg exited with code ${code}`;
      return reject(new Error(message));
    });
  });
}

module.exports = {
  runFfmpeg,
  SEGMENT_DURATION_SECONDS,
};
