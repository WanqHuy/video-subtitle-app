const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const Groq = require('groq-sdk');
const User = require('../models/User');

// DÁN API KEY GROQ MỚI CỦA BẠN VÀO ĐÂY NẾU CHƯA CÓ TRONG FILE .ENV:
const GROQ_API_KEY_FALLBACK = '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';

const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY || GROQ_API_KEY_FALLBACK
});

const getVideoDurationMinutes = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const seconds = (metadata && metadata.format && metadata.format.duration) ? metadata.format.duration : 0;
      resolve(Math.max(1, Math.ceil(seconds / 60)));
    });
  });
};

exports.getWorkspace = async (req, res) => {
  const user = await User.findById(req.session.user.id || req.session.user._id).lean();
  res.render('workspace', { 
    title: 'Studio Phụ Đề AI',
    tier: user ? (user.tier || 'free') : 'free'
  });
};

exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.render('workspace', { 
        title: 'Studio Phụ Đề AI', 
        error: 'Vui lòng chọn một tệp video hợp lệ!' 
      });
    }

    const userId = req.session.user.id || req.session.user._id;
    const user = await User.findById(userId);
    const userTier = user ? (user.tier || 'free') : 'free';

    const videoDuration = await getVideoDurationMinutes(req.file.path);

    const MAX_LIMITS = {
      free: 3,
      basic: 15,
      pro: 60,
      enterprise: 999
    };

    const maxAllowed = MAX_LIMITS[userTier] || 3;
    if (videoDuration > maxAllowed) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.render('workspace', {
        title: 'Studio Phụ Đề AI',
        tier: userTier,
        error: `Gói cước [${userTier.toUpperCase()}] chỉ cho phép video tối đa ${maxAllowed} phút/lần. Video này dài ${videoDuration} phút. Vui lòng nâng cấp gói cao hơn!`
      });
    }

    if (!user || user.remainingMinutes < videoDuration) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      const currentMin = user ? user.remainingMinutes : 0;
      return res.render('workspace', {
        title: 'Studio Phụ Đề AI',
        tier: userTier,
        error: `Tài khoản của bạn chỉ còn ${currentMin} phút, nhưng video dài ${videoDuration} phút. Vui lòng mua thêm gói cước!`
      });
    }

    req.session.currentVideoDuration = videoDuration;

    const audioPath = path.join(__dirname, '../../uploads', `${req.file.filename}.mp3`);

    // Tách âm thanh MP3 từ video
    await new Promise((resolve, reject) => {
      ffmpeg(req.file.path)
        .noVideo()
        .audioCodec('libmp3lame')
        .output(audioPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Gọi AI Whisper
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-large-v3',
      prompt: userTier === 'free' ? '' : 'Dịch thuật và nhận diện chuẩn tiếng Việt có dấu, lọc sạch tạp âm, ngắt câu theo ngữ cảnh',
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
    console.error('Lỗi xử lý video:', err);
    res.render('workspace', { 
      title: 'Studio Phụ Đề AI', 
      error: `Lỗi xử lý âm thanh: ${err.message}` 
    });
  }
};

exports.renderVideo = async (req, res) => {
  try {
    const { videoFilename, srtContent, fontName, fontSize, fontColor } = req.body;
    const srtPath = path.join(__dirname, '../../uploads', `${videoFilename}.srt`);
    const outputFilename = `subtitled-${videoFilename}`;
    const outputPath = path.join(__dirname, '../../public/outputs', outputFilename);
    const inputPath = path.join(__dirname, '../../uploads', videoFilename);

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

    ffmpeg(inputPath)
      .outputOptions(['-vf', filterComplex])
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
        console.error('Lỗi render:', err);
        res.render('workspace', { 
          title: 'Studio Phụ Đề AI', 
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