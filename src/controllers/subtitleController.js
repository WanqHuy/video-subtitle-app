require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const translate = require('@iamtraction/google-translate');

ffmpeg.setFfmpegPath(ffmpegPath);
const groq = new Groq({ apiKey: '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' });

function formatSRTTime(seconds) {
  const totalMs = Math.floor(seconds * 1000);
  const ms = String(totalMs % 1000).padStart(3, '0');
  const totalSeconds = Math.floor(totalMs / 1000);
  const ss = String(totalSeconds % 60).padStart(2, '0');
  const mm = String(Math.floor((totalSeconds / 60) % 60)).padStart(2, '0');
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

exports.getWorkspace = (req, res) => {
  res.render('workspace', { title: 'Công Cụ Tạo Phụ Đề Video Tự Động' });
};

// BƯỚC 1: Xử lý AI nhận diện, dịch và trả về giao diện chỉnh sửa
exports.processVideo = async (req, res) => {
  if (!req.file) {
    return res.render('workspace', {
      title: 'Công Cụ Tạo Phụ Đề',
      error: 'Vui lòng chọn file video!',
    });
  }

  // Chuyển video sang thư mục public/temp_videos để người dùng có thể xem trước
  const tempDir = path.join(__dirname, '../../public/temp_videos');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const videoFilename = path.basename(req.file.path);
  const tempVideoPath = path.join(tempDir, videoFilename);
  fs.copyFileSync(req.file.path, tempVideoPath);

  try {
    // 1. Whisper nhận diện và lấy timestamp
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'whisper-large-v3',
      response_format: 'verbose_json',
      temperature: 0.0,
    });

    let segments = transcription.segments || [];
    if (segments.length === 0 && transcription.text) {
      segments = [{ start: 0, end: 5, text: transcription.text }];
    }

    const detectedLanguage = transcription.language || '';

    // 2. Tự động dịch sang Tiếng Việt nếu video là ngoại ngữ
    if (detectedLanguage !== 'vi' && detectedLanguage !== 'vietnamese' && segments.length > 0) {
      for (const seg of segments) {
        const cleanText = seg.text.trim();
        if (cleanText) {
          try {
            const tr = await translate(cleanText, { to: 'vi' });
            seg.text = tr.text;
          } catch (e) {
            console.warn('Lỗi dịch câu:', e.message);
          }
        }
      }
    }

    // Định dạng thành danh sách các dòng sub có index, start, end, text
    const subtitleList = segments.map((seg, idx) => ({
      index: idx + 1,
      startTime: formatSRTTime(seg.start),
      endTime: formatSRTTime(seg.end),
      text: seg.text.trim()
    }));

    // Chuẩn bị nội dung SRT ban đầu
let srtContent = '';
    subtitleList.forEach((s) => {
      srtContent += `${s.index}\n${s.startTime} --> ${s.endTime}\n${s.text}\n\n`;
    });

    res.render('workspace', {
      title: 'Chỉnh Sửa & Tùy Biến Phụ Đề',
      step2: true,
      originalName: req.file.originalname,
      videoFilename: videoFilename,
      videoUrl: `/temp_videos/${videoFilename}`,
      subtitleList: subtitleList,
      srtContent: srtContent
    });

  } catch (error) {
    console.error('Lỗi AI:', error);
    res.render('workspace', {
      title: 'Lỗi AI',
      error: 'Không thể phân tích video: ' + error.message,
    });
  }
};

// BƯỚC 2: Nhận phụ đề đã sửa + font chữ để FFmpeg gắn cứng vào video
exports.renderFinalVideo = async (req, res) => {
  const { videoFilename, srtContent, fontName, fontSize, fontColor, outlineColor } = req.body;
  const tempVideoPath = path.join(__dirname, '../../public/temp_videos', videoFilename);

  if (!fs.existsSync(tempVideoPath)) {
    return res.render('workspace', {
      title: 'Lỗi',
      error: 'Không tìm thấy file video tạm thời. Vui lòng tải lại từ đầu!',
    });
  }

  const timestamp = Date.now();
  const srtPath = path.join(__dirname, '../../uploads', `${timestamp}.srt`);
  const outputVideoName = `subtitled-${timestamp}.mp4`;
  const outputDir = path.join(__dirname, '../../public/outputs');
  const outputVideoPath = path.join(outputDir, outputVideoName);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Ghi file SRT sau khi người dùng đã chỉnh sửa
  fs.writeFileSync(srtPath, srtContent.replace(/\r\n/g, '\n'), 'utf-8');

  const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');

  // Bản đồ màu sắc chuẩn ASS / FFmpeg (&HAABBGGRR)
  let primaryColour = '&H00FFFFFF'; // Mặc định: Trắng
  if (fontColor === 'yellow') primaryColour = '&H0000FFFF';
  if (fontColor === 'cyan') primaryColour = '&H00FFFF00';
  if (fontColor === 'green') primaryColour = '&H0000FF00';

  let borderColour = '&H00000000'; // Mặc định: Viền Đen
  if (outlineColor === 'none') borderColour = '&H00FFFFFF';

  const selectedFont = fontName || 'Arial';
  const selectedSize = fontSize || '22';

  ffmpeg(tempVideoPath)
    .outputOptions([
      `-vf subtitles='${escapedSrtPath}':force_style='FontName=${selectedFont},FontSize=${selectedSize},PrimaryColour=${primaryColour},OutlineColour=${borderColour},BorderStyle=3,MarginV=25'`,
      '-pix_fmt yuv420p',
      '-movflags +faststart',
    ])
    .videoCodec('libx264')
    .audioCodec('aac')
    .on('start', () => {
      console.log('Bắt đầu render video với font:', selectedFont);
    })
    .on('end', () => {
      try {
        if (fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
      } catch (e) {
        console.warn(e.message);
      }

      res.render('workspace', {
        title: 'Video Hoàn Tất',
finalSuccess: true,
        outputVideoUrl: `/outputs/${outputVideoName}`,
        srtContent: srtContent
      });
    })
    .on('error', (err) => {
      console.error('Lỗi FFmpeg:', err.message);
      res.render('workspace', {
        title: 'Lỗi Xử Lý Video',
        error: 'Có lỗi khi xuất video: ' + err.message,
      });
    })
    .save(outputVideoPath);
};
