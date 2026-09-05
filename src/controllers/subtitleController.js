const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const Groq = require('groq-sdk');
const User = require('../models/User');

// Gán đường dẫn FFmpeg & FFprobe
try {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
} catch (e) {
  console.log('Sử dụng FFmpeg mặc định hệ thống');
}

const GROQ_API_KEY_FALLBACK = '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';
const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY || GROQ_API_KEY_FALLBACK 
});

const getVideoDurationMinutes = (filePath) => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return resolve(1);
      const seconds = (metadata && metadata.format && metadata.format.duration) ? metadata.format.duration : 0;
      resolve(Math.max(1, Math.ceil(seconds / 60)));
    });
  });
};

exports.getWorkspace = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id || req.session.user._id).lean();
    res.render('workspace', { 
      title: 'Studio Phụ Đề AI',
      tier: user ? (user.tier || 'free') : 'free'
    });
  } catch (err) {
    res.render('workspace', { title: 'Studio Phụ Đề AI', tier: 'free' });
  }
};

exports.uploadVideo = async (req, res) => {
  let uploadedPath = req.file ? req.file.path : null;
  let audioPath = null;

  try {
    if (!req.file) {
      return res.render('workspace', { 
        title: 'Studio Phụ Đề AI', 
        error: 'Vui lòng chọn hoặc kéo thả một tệp video hợp lệ!' 
      });
    }

    const userId = req.session.user.id || req.session.user._id;
    const user = await User.findById(userId);
    const userTier = user ? (user.tier || 'free') : 'free';

    // Đo thời lượng video
    const videoDuration = await getVideoDurationMinutes(uploadedPath);

    // Kiểm tra giới hạn cấp bậc
    const MAX_LIMITS = { free: 3, basic: 15, pro: 60, enterprise: 999 };
    const maxAllowed = MAX_LIMITS[userTier] || 3;
    if (videoDuration > maxAllowed) {
      if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
      return res.render('workspace', {
        title: 'Studio Phụ Đề AI',
        tier: userTier,
        error: `Gói [${userTier.toUpperCase()}] chỉ hỗ trợ tối đa ${maxAllowed} phút/video. Video này dài ${videoDuration} phút. Vui lòng nâng cấp gói!`
      });
    }

    // Kiểm tra số phút còn lại
    if (!user || user.remainingMinutes < videoDuration) {
      if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
      const currentMin = user ? user.remainingMinutes : 0;
      return res.render('workspace', {
        title: 'Studio Phụ Đề AI',
        tier: userTier,
        error: `Tài khoản chỉ còn ${currentMin} phút, không đủ xử lý video dài ${videoDuration} phút. Vui lòng mua thêm gói!`
      });
    }

    req.session.currentVideoDuration = videoDuration;

    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    audioPath = path.join(uploadDir, `${req.file.filename}.mp3`);

    // TỐI ƯU SIÊU TỐC:
    // -ac 1: chuyển về âm thanh mono (nhẹ gấp đôi)
    // -ar 16000: chuẩn lấy mẫu 16kHz của Whisper AI
    // -b:a 48k: giảm bitrate để file nhẹ dưới 1MB, upload sang Groq mất chưa đầy 0.5s
    await new Promise((resolve, reject) => {
      ffmpeg(uploadedPath)
        .noVideo()
        .audioChannels(1)
        .audioFrequency(16000)
        .audioBitrate('48k')
        .audioCodec('libmp3lame')
        .outputOptions(['-q:a 9'])
        .output(audioPath)
        .on('end', resolve)
        .on('error', (err) => reject(new Error('Lỗi trích xuất audio: ' + err.message)))
        .run();
    });

    // Gửi âm thanh sang Groq Whisper v3
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-large-v3',
      prompt: userTier === 'free' ? '' : 'Dịch thuật và nhận diện chuẩn tiếng Việt có dấu, lọc tạp âm, ngắt câu theo ngữ cảnh',
      response_format: 'verbose_json'
    });

    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }

    const segments = transcription.segments || [];
    const formatTime = (secs) => {
      const pad = (n, z = 2) => ('00' + n).slice(-z);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = Math.floor(secs % 60);
      const ms = Math.floor((secs % 1) * 1000);
      return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
    };

    const subtitleList = segments.map((seg, idx) => ({
      index: idx + 1,
      startTime: formatTime(seg.start),
      endTime: formatTime(seg.end),
      text: seg.text ? seg.text.trim() : ''
    }));

    res.render('workspace', {
      title: 'Biên Tập Phụ Đề',
      step2: true,
      tier: userTier,
      videoFilename: req.file.filename,
      videoUrl: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      subtitleList,
      videoDuration
    });
  } catch (err) {
    console.error('Lỗi khi xử lý video:', err);
    if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    res.render('workspace', { 
      title: 'Studio Phụ Đề AI', 
      tier: req.session.user ? req.session.user.tier : 'free',
      error: `Lỗi xử lý hệ thống: ${err.message}` 
    });
  }
};

exports.renderVideo = async (req, res) => {
  try {
    const { videoFilename, srtContent, fontName, fontSize, fontColor } = req.body;
    
    const uploadDir = path.join(__dirname, '../../uploads');
    const outputDir = path.join(__dirname, '../../public/outputs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const srtPath = path.join(uploadDir, `${videoFilename}.srt`);
    const outputFilename = `subtitled-${videoFilename}`;
    const outputPath = path.join(outputDir, outputFilename);
    const inputPath = path.join(uploadDir, videoFilename);

    const userId = req.session.user.id || req.session.user._id;
    const user = await User.findById(userId);
    const userTier = user ? (user.tier || 'free') : 'free';

    fs.writeFileSync(srtPath, srtContent, 'utf-8');

    const normalizedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');

    let primaryColorCode = '&H00FFFFFF';
    if (userTier !== 'free') {
      if (fontColor === 'yellow') primaryColorCode = '&H0000FFFF';
      if (fontColor === 'cyan') primaryColorCode = '&H00FFFF00';
      if (fontColor === 'green') primaryColorCode = '&H0066FF00';
    }

    let subtitleFilter = `subtitles='${normalizedSrtPath}':force_style='FontName=${fontName || 'Arial'},FontSize=${fontSize || '22'},PrimaryColour=${primaryColorCode},OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1'`;

    let filterComplex = subtitleFilter;
    if (userTier === 'free' || userTier === 'basic') {
      filterComplex += `,drawtext=text='AI SUBTITLE FREE TIER':x=20:y=20:fontsize=18:fontcolor=white@0.8:box=1:boxcolor=black@0.5:boxborderw=5`;
    }

    // TỐI ƯU RENDER:
    // Thêm -preset ultrafast và -threads 1 giúp Render Free chạy mượt, không bị tràn 512MB RAM
    ffmpeg(inputPath)
      .outputOptions([
        '-vf', filterComplex,
        '-preset', 'ultrafast',
        '-tune', 'fastdecode',
        '-crf', '26',
        '-threads', '1'
      ])
      .videoCodec('libx264')
      .audioCodec('copy')
      .output(outputPath)
      .on('end', async () => {
        if (fs.existsSync(srtPath)) fs.unlinkSync(srtPath);

        const durationToDeduct = req.session.currentVideoDuration || 1;
        if (req.session.user) {
          await User.findByIdAndUpdate(userId, {
            $inc: { remainingMinutes: -durationToDeduct }
          });
        }
        req.session.currentVideoDuration = null;

        res.render('workspace', {
          title: 'Xuất Video Thành Công',
          finalSuccess: true,
          tier: userTier,
          outputVideoUrl: `/outputs/${outputFilename}`,
          srtContent
        });
      })
      .on('error', (err) => {
        console.error('Lỗi render video:', err);
        res.render('workspace', { 
          title: 'Studio Phụ Đề AI', 
          tier: userTier,
          error: `Lỗi render video: ${err.message}` 
        });
      })
      .run();
  } catch (err) {
    res.render('workspace', { 
      title: 'Studio Phụ Đề AI', 
      error: err.message 
    });
  }
};