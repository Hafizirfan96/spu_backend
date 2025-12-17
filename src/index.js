const express = require('express');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const { sendOtp, verifyOtp } = require('./otpService');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs/promises');
const multer = require('multer');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET || 'change-me';
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true;

app.use(express.json());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: allowedOrigins !== true
  })
);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
const upload = multer({ storage: multer.memoryStorage() });

// Simple health endpoint to confirm API is running and database is reachable.
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed', error);
    res.status(500).json({ status: 'error', message: 'Database unreachable' });
  }
});

// Send OTP to email
app.post('/otp/send', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    await sendOtp(email);
    res.json({ message: 'OTP sent' });
  } catch (error) {
    console.error('Failed to send OTP', error);
    res.status(500).json({ error: 'Unable to send OTP', detail: error.message || 'smtp_error' });
  }
});

// Verify OTP
app.post('/otp/verify', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }
    const result = verifyOtp(email, code, { consume: false });
    if (!result.ok) {
      return res.status(400).json({ error: 'Invalid or expired code', reason: result.reason });
    }
    res.json({ message: 'OTP verified' });
  } catch (error) {
    console.error('Failed to verify OTP', error);
    res.status(500).json({ error: 'Unable to verify OTP' });
  }
});

function signToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: '24h' });
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function ensureUserFolders(userId) {
  const base = path.join(__dirname, '..', 'uploads', String(userId));
  await fs.mkdir(base, { recursive: true });
  await fs.mkdir(path.join(base, 'qualifications'), { recursive: true });
  await fs.mkdir(path.join(base, 'experiences'), { recursive: true });
  return base;
}

async function ensureUserFolders(userId) {
  const base = path.join(__dirname, '..', 'uploads', String(userId));
  await fs.mkdir(base, { recursive: true });
  await fs.mkdir(path.join(base, 'qualifications'), { recursive: true });
  await fs.mkdir(path.join(base, 'experiences'), { recursive: true });
  return base;
}

// Signup: verify OTP, create applicant with hashed password
app.post('/auth/signup', async (req, res) => {
  try {
    const { fullName, cnic, email, username, password, postId, code } = req.body || {};
    if (!fullName || !cnic || !email || !username || !password || !postId || !code) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const otpResult = verifyOtp(email, code, { consume: true });
    if (!otpResult.ok) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    const existing = await prisma.applicant.findFirst({
      where: {
        OR: [{ email }, { username }, { cnic }]
      }
    });
    if (existing) {
      return res.status(409).json({ error: 'User already exists with provided email/username/cnic' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const applicant = await prisma.applicant.create({
      data: {
        fullName,
        cnic,
        email,
        username,
        password: hashed,
        postId: Number(postId)
      },
      select: { id: true, fullName: true, email: true, username: true, postId: true }
    });

    await ensureUserFolders(applicant.id);

    const token = signToken({ sub: applicant.id, email: applicant.email, username: applicant.username });
    res.json({ token, applicant });
  } catch (error) {
    console.error('Signup error', error);
    res.status(500).json({ error: 'Unable to signup', detail: error.message });
  }
});

// Login: check credentials and return token
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const user = await prisma.applicant.findFirst({
      where: { username }
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ sub: user.id, email: user.email, username: user.username });
    res.json({ token, applicant: { id: user.id, fullName: user.fullName, email: user.email, username: user.username, postId: user.postId } });
  } catch (error) {
    console.error('Login error', error);
    res.status(500).json({ error: 'Unable to login' });
  }
});

// Posts and districts for dropdowns
app.get('/posts', async (req, res) => {
  try {
    const posts = await prisma.post.findMany({ orderBy: { id: 'asc' } });
    res.json(posts);
  } catch (error) {
    console.error('Posts fetch error', error);
    res.status(500).json({ error: 'Unable to fetch posts' });
  }
});

app.get('/districts', async (req, res) => {
  try {
    const districts = await prisma.district.findMany({ orderBy: { name: 'asc' } });
    res.json(districts);
  } catch (error) {
    console.error('Districts fetch error', error);
    res.status(500).json({ error: 'Unable to fetch districts' });
  }
});

// Get current applicant profile
app.get('/applicant', authenticate, async (req, res) => {
  try {
    const applicant = await prisma.applicant.findUnique({
      where: { id: req.user.sub },
      include: { post: true, district: true }
    });
    if (!applicant) return res.status(404).json({ error: 'Applicant not found' });
    res.json(applicant);
  } catch (error) {
    console.error('Get applicant error', error);
    res.status(500).json({ error: 'Unable to fetch applicant' });
  }
});

// Update applicant profile
app.put('/applicant', authenticate, async (req, res) => {
  try {
    const applicant = await prisma.applicant.findUnique({ where: { id: req.user.sub } });
    if (!applicant) return res.status(404).json({ error: 'Applicant not found' });
    if (applicant.submissionStatus === 'SUBMITTED') {
      return res.status(400).json({ error: 'Application already submitted, edits not allowed' });
    }

    const {
      fullName,
      fatherName,
      cnic,
      email,
      username,
      cellNo,
      dob,
      gender,
      postId,
      districtId,
      otherDistrict,
      address,
      urlProfilePic,
      urlCv,
      urlCnic,
      urlAcademicCerts,
      urlExperienceCerts
    } = req.body || {};

    const data = {
      ...(fullName !== undefined && { fullName }),
      ...(fatherName !== undefined && { fatherName }),
      ...(cnic !== undefined && { cnic }),
      ...(email !== undefined && { email }),
      ...(username !== undefined && { username }),
      ...(cellNo !== undefined && { cellNo }),
      ...(dob ? { dob: new Date(dob) } : dob === null ? { dob: null } : {}),
      ...(gender ? { gender } : gender === null ? { gender: null } : {}),
      ...(postId ? { postId: Number(postId) } : postId === null ? { postId: null } : {}),
      ...(districtId ? { districtId: Number(districtId) } : districtId === null ? { districtId: null } : {}),
      ...(otherDistrict !== undefined && { otherDistrict }),
      ...(address !== undefined && { address }),
      ...(urlProfilePic !== undefined && { urlProfilePic }),
      ...(urlCv !== undefined && { urlCv }),
      ...(urlCnic !== undefined && { urlCnic }),
      ...(urlAcademicCerts !== undefined && { urlAcademicCerts }),
      ...(urlExperienceCerts !== undefined && { urlExperienceCerts })
    };

    const updated = await prisma.applicant.update({
      where: { id: req.user.sub },
      data
    });

    res.json(updated);
  } catch (error) {
    console.error('Update applicant error', error);
    res.status(500).json({ error: 'Unable to update applicant', detail: error.message });
  }
});

// Submit application (lock)
app.post('/application/submit', authenticate, async (req, res) => {
  try {
    const applicant = await prisma.applicant.findUnique({
      where: { id: req.user.sub },
      include: { qualifications: true, experiences: true }
    });
    if (!applicant) return res.status(404).json({ error: 'Applicant not found' });
    if (applicant.submissionStatus === 'SUBMITTED') {
      return res.status(400).json({ error: 'Already submitted' });
    }
    const hasProfile = applicant.fullName && applicant.cnic && applicant.email && applicant.username && applicant.postId;
    const hasProfilePic = !!applicant.urlProfilePic;
    const hasQuals = applicant.qualifications.length > 0;
    const hasExps = applicant.experiences.length > 0;
    const hasDocs = applicant.urlCv && applicant.urlAcademicCerts && applicant.urlExperienceCerts && applicant.urlCnic;
    if (!hasProfile || !hasProfilePic || !hasQuals || !hasExps || !hasDocs) {
      return res.status(400).json({ error: 'Missing required data before submission' });
    }
    await prisma.applicant.update({
      where: { id: req.user.sub },
      data: { submissionStatus: 'SUBMITTED' }
    });
    res.json({ submitted: true });
  } catch (error) {
    console.error('Submit application error', error);
    res.status(500).json({ error: 'Unable to submit application', detail: error.message });
  }
});

// Application PDF download
app.get('/application/pdf', authenticate, async (req, res) => {
  try {
    const applicant = await prisma.applicant.findUnique({
      where: { id: req.user.sub },
      include: {
        post: true,
        district: true,
        qualifications: true,
        experiences: true
      }
    });
    if (!applicant) return res.status(404).json({ error: 'Applicant not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="application.pdf"');

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    const pageWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const sectionTitle = (text) => {
      if (doc.y + 30 > doc.page.height - doc.page.margins.bottom) doc.addPage();
      doc.save();
      doc.rect(doc.page.margins.left, doc.y, pageWidth(), 24).fill('#0f4ec7');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(12).text(text, doc.page.margins.left, doc.y + 6, { width: pageWidth(), align: 'center' });
      doc.restore();
      doc.moveDown(1.2);
    };

    const subsectionTitle = (text) => {
      if (doc.y + 20 > doc.page.height - doc.page.margins.bottom) doc.addPage();
      doc.save();
      doc.rect(doc.page.margins.left, doc.y, pageWidth(), 18).fill('#eef2f9');
      doc.fillColor('#0f4ec7').font('Helvetica-Bold').fontSize(11).text(text, doc.page.margins.left + 6, doc.y + 3, { width: pageWidth() - 12 });
      doc.restore();
      doc.moveDown(0.6);
    };

    const boxRow = (pairs) => {
      // pairs: array of [label, value]
      const colWidth = pageWidth() / 2;
      const labelWidth = 80;
      const lineHeight = 20;
      if (doc.y + lineHeight + 10 > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const startY = doc.y;
      pairs.forEach((pair, idx) => {
        const [label, value] = pair;
        const x = doc.page.margins.left + idx * colWidth;
        doc.save();
        doc.rect(x, startY, labelWidth, lineHeight).fill('#f0f4ff').stroke('#d0d7e4');
        doc.fillColor('#0f4ec7').font('Helvetica-Bold').fontSize(9).text(label, x + 4, startY + 4, { width: labelWidth - 8 });
        doc.restore();

        doc.save();
        doc.rect(x + labelWidth, startY, colWidth - labelWidth, lineHeight).fill('#fff').stroke('#d0d7e4');
        doc.fillColor('#111').font('Helvetica').fontSize(9).text(value || '-', x + labelWidth + 4, startY + 4, { width: colWidth - labelWidth - 8 });
        doc.restore();
      });
      doc.y = startY + lineHeight + 8;
    };

    doc.fontSize(16).font('Helvetica-Bold').text('Government of the Punjab', { align: 'center' });
    doc.fontSize(14).font('Helvetica-Bold').text('Skills Development and Entrepreneurship Department', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica-Bold').text('Application Form', { align: 'center' });
    doc.moveDown(1.5);

    sectionTitle('Profile');
    boxRow([
      ['Full Name', applicant.fullName],
      ['Father Name', applicant.fatherName]
    ]);
    boxRow([
      ['CNIC', applicant.cnic],
      ['Email', applicant.email]
    ]);
    boxRow([
      ['Username', applicant.username],
      ['Cell No', applicant.cellNo]
    ]);
    boxRow([
      ['Date of Birth', applicant.dob ? applicant.dob.toISOString().slice(0, 10) : '-'],
      ['Gender', applicant.gender || '-']
    ]);
    boxRow([
      ['Post', applicant.post?.name || '-'],
      ['District', applicant.district?.name || applicant.otherDistrict || '-']
    ]);
    boxRow([
      ['Address', applicant.address || '-'],
      ['Submission Status', applicant.submissionStatus || '-']
    ]);
    doc.moveDown(0.5);

    sectionTitle('Qualifications');
    if (!applicant.qualifications.length) {
      doc.font('Helvetica').text('No qualifications provided.');
    } else {
      applicant.qualifications.forEach((q, idx) => {
        subsectionTitle(`Qualification ${idx + 1}`);
        boxRow([
          ['Degree Type', `${q.degreeType}${q.degreeType === 'OTHER' && q.degreeTypeOther ? ` (${q.degreeTypeOther})` : ''}`],
          ['Field of Study', `${q.fieldOfStudy}${q.fieldOfStudy === 'OTHER' && q.fieldOfStudyOther ? ` (${q.fieldOfStudyOther})` : ''}`]
        ]);
        boxRow([
          ['Institution', q.institutionName],
          ['Country', `${q.institutionCountry}${q.institutionCountry === 'OTHER' && q.institutionCountryOther ? ` (${q.institutionCountryOther})` : ''}`]
        ]);
        boxRow([
          ['Graduation Year', q.graduationYear],
          ['Grade/CGPA', q.grade]
        ]);
        boxRow([
          ['Duration (months)', q.durationMonths],
          ['Foreign Degree', q.isForeign ? 'Yes' : 'No']
        ]);
        boxRow([
          ['Notes', q.notes || '-'],
          ['', '']
        ]);
        doc.moveDown(0.5);
      });
    }

    sectionTitle('Experiences');
    if (!applicant.experiences.length) {
      doc.font('Helvetica').text('No experiences provided.');
    } else {
      applicant.experiences.forEach((e, idx) => {
        subsectionTitle(`Experience ${idx + 1}`);
        boxRow([
          ['Organization', e.organizationName],
          ['Type', e.organizationType]
        ]);
        boxRow([
          ['Department', e.department],
          ['Designation', e.designation]
        ]);
        boxRow([
          ['Grade', e.grade],
          ['District', e.districtId ? (applicant.district?.name || '-') : '-']
        ]);
        boxRow([
          ['Start Date', e.startDate ? e.startDate.toISOString().slice(0, 10) : '-'],
          ['End Date', e.endDate ? e.endDate.toISOString().slice(0, 10) : e.isCurrent ? 'Current' : '-']
        ]);
        boxRow([
          ['Country', `${e.country}${e.country === 'OTHER' && e.countryOther ? ` (${e.countryOther})` : ''}`],
          ['Foreign Posting', e.country !== 'PAKISTAN' ? 'Yes' : 'No']
        ]);
        boxRow([
          ['Duties', e.dutiesSummary || '-'],
          ['Achievements', e.achievements || '-']
        ]);
        doc.moveDown(0.5);
      });
    }

    sectionTitle('Documents');
    boxRow([
      ['Profile Picture', applicant.urlProfilePic ? 'Uploaded' : 'Missing'],
      ['CV', applicant.urlCv ? 'Uploaded' : 'Missing']
    ]);
    boxRow([
      ['Academic Certificates', applicant.urlAcademicCerts ? 'Uploaded' : 'Missing'],
      ['Experience Certificates', applicant.urlExperienceCerts ? 'Uploaded' : 'Missing']
    ]);
    boxRow([
      ['CNIC', applicant.urlCnic ? 'Uploaded' : 'Missing'],
      ['', '']
    ]);

    doc.end();
  } catch (error) {
    console.error('PDF generation error', error);
    res.status(500).json({ error: 'Unable to generate PDF', detail: error.message });
  }
});
// Qualifications CRUD
app.get('/qualifications', authenticate, async (req, res) => {
  try {
    const quals = await prisma.qualification.findMany({
      where: { applicantId: req.user.sub },
      orderBy: { id: 'asc' }
    });
    res.json(quals);
  } catch (error) {
    console.error('Get qualifications error', error);
    res.status(500).json({ error: 'Unable to fetch qualifications' });
  }
});

app.post('/qualifications', authenticate, async (req, res) => {
  try {
    const applicant = await prisma.applicant.findUnique({ where: { id: req.user.sub } });
    if (!applicant) return res.status(404).json({ error: 'Applicant not found' });
    if (applicant.submissionStatus === 'SUBMITTED') {
      return res.status(400).json({ error: 'Application already submitted, edits not allowed' });
    }

    const {
      degreeType,
      degreeTypeOther,
      fieldOfStudy,
      fieldOfStudyOther,
      institutionName,
      institutionCountry,
      institutionCountryOther,
      graduationYear,
      grade,
      durationMonths,
      isForeign,
      notes
    } = req.body || {};

    if (!degreeType || !fieldOfStudy || !institutionName || !institutionCountry || !graduationYear || !grade || durationMonths === undefined || isForeign === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const created = await prisma.qualification.create({
      data: {
        applicantId: req.user.sub,
        degreeType,
        degreeTypeOther: degreeType === 'OTHER' ? degreeTypeOther || '' : null,
        fieldOfStudy,
        fieldOfStudyOther: fieldOfStudy === 'OTHER' ? fieldOfStudyOther || '' : null,
        institutionName,
        institutionCountry,
        institutionCountryOther: institutionCountry === 'OTHER' ? institutionCountryOther || '' : null,
        graduationYear: Number(graduationYear),
        grade,
        durationMonths: Number(durationMonths),
        isForeign: Boolean(isForeign),
        notes
      }
    });
    res.json(created);
  } catch (error) {
    console.error('Create qualification error', error);
    res.status(500).json({ error: 'Unable to create qualification', detail: error.message });
  }
});

app.put('/qualifications/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const existing = await prisma.qualification.findFirst({ where: { id, applicantId: req.user.sub } });
    if (!existing) return res.status(404).json({ error: 'Qualification not found' });
    const applicant = await prisma.applicant.findUnique({ where: { id: req.user.sub } });
    if (applicant && applicant.submissionStatus === 'SUBMITTED') {
      return res.status(400).json({ error: 'Application already submitted, edits not allowed' });
    }

    const {
      degreeType,
      degreeTypeOther,
      fieldOfStudy,
      fieldOfStudyOther,
      institutionName,
      institutionCountry,
      institutionCountryOther,
      graduationYear,
      grade,
      durationMonths,
      isForeign,
      notes
    } = req.body || {};

    const updated = await prisma.qualification.update({
      where: { id },
      data: {
        ...(degreeType && { degreeType }),
        degreeTypeOther: degreeType === 'OTHER' ? degreeTypeOther || '' : null,
        ...(fieldOfStudy && { fieldOfStudy }),
        fieldOfStudyOther: fieldOfStudy === 'OTHER' ? fieldOfStudyOther || '' : null,
        ...(institutionName !== undefined && { institutionName }),
        ...(institutionCountry !== undefined && { institutionCountry }),
        institutionCountryOther: institutionCountry === 'OTHER' ? institutionCountryOther || '' : null,
        ...(graduationYear !== undefined && { graduationYear: Number(graduationYear) }),
        ...(grade !== undefined && { grade }),
        ...(durationMonths !== undefined && { durationMonths: Number(durationMonths) }),
        ...(isForeign !== undefined && { isForeign: Boolean(isForeign) }),
        ...(notes !== undefined && { notes })
      }
    });
    res.json(updated);
  } catch (error) {
    console.error('Update qualification error', error);
    res.status(500).json({ error: 'Unable to update qualification', detail: error.message });
  }
});

app.delete('/qualifications/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const existing = await prisma.qualification.findFirst({ where: { id, applicantId: req.user.sub } });
    if (!existing) return res.status(404).json({ error: 'Qualification not found' });
    const applicant = await prisma.applicant.findUnique({ where: { id: req.user.sub } });
    if (applicant && applicant.submissionStatus === 'SUBMITTED') {
      return res.status(400).json({ error: 'Application already submitted, edits not allowed' });
    }
    await prisma.qualification.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete qualification error', error);
    res.status(500).json({ error: 'Unable to delete qualification', detail: error.message });
  }
});

// Experiences CRUD
app.get('/experiences', authenticate, async (req, res) => {
  try {
    const exps = await prisma.experience.findMany({
      where: { applicantId: req.user.sub },
      orderBy: { id: 'asc' }
    });
    res.json(exps);
  } catch (error) {
    console.error('Get experiences error', error);
    res.status(500).json({ error: 'Unable to fetch experiences' });
  }
});

app.post('/experiences', authenticate, async (req, res) => {
  try {
    const applicant = await prisma.applicant.findUnique({ where: { id: req.user.sub } });
    if (!applicant) return res.status(404).json({ error: 'Applicant not found' });
    if (applicant.submissionStatus === 'SUBMITTED') {
      return res.status(400).json({ error: 'Application already submitted, edits not allowed' });
    }
    const {
      organizationName,
      organizationType,
      department,
      designation,
      grade,
      startDate,
      endDate,
      isCurrent,
      dutiesSummary,
      achievements,
      districtId,
      country,
      countryOther
    } = req.body || {};

    if (!organizationName || !organizationType || !department || !designation || !grade || !startDate || isCurrent === undefined || !districtId || !country) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const created = await prisma.experience.create({
      data: {
        applicantId: req.user.sub,
        organizationName,
        organizationType,
        department,
        designation,
        grade,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isCurrent: Boolean(isCurrent),
        dutiesSummary,
        achievements,
        districtId: Number(districtId),
        country,
        countryOther: country === 'OTHER' ? countryOther || '' : null
      }
    });
    res.json(created);
  } catch (error) {
    console.error('Create experience error', error);
    res.status(500).json({ error: 'Unable to create experience', detail: error.message });
  }
});

app.put('/experiences/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const existing = await prisma.experience.findFirst({ where: { id, applicantId: req.user.sub } });
    if (!existing) return res.status(404).json({ error: 'Experience not found' });
    const applicant = await prisma.applicant.findUnique({ where: { id: req.user.sub } });
    if (applicant && applicant.submissionStatus === 'SUBMITTED') {
      return res.status(400).json({ error: 'Application already submitted, edits not allowed' });
    }

    const {
      organizationName,
      organizationType,
      department,
      designation,
      grade,
      startDate,
      endDate,
      isCurrent,
      dutiesSummary,
      achievements,
      districtId,
      country,
      countryOther
    } = req.body || {};

    const updated = await prisma.experience.update({
      where: { id },
      data: {
        ...(organizationName !== undefined && { organizationName }),
        ...(organizationType !== undefined && { organizationType }),
        ...(department !== undefined && { department }),
        ...(designation !== undefined && { designation }),
        ...(grade !== undefined && { grade }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isCurrent !== undefined && { isCurrent: Boolean(isCurrent) }),
        ...(dutiesSummary !== undefined && { dutiesSummary }),
        ...(achievements !== undefined && { achievements }),
        ...(districtId !== undefined && { districtId: Number(districtId) }),
        ...(country !== undefined && { country }),
        countryOther: country === 'OTHER' ? countryOther || '' : null
      }
    });
    res.json(updated);
  } catch (error) {
    console.error('Update experience error', error);
    res.status(500).json({ error: 'Unable to update experience', detail: error.message });
  }
});

app.delete('/experiences/:id', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const existing = await prisma.experience.findFirst({ where: { id, applicantId: req.user.sub } });
    if (!existing) return res.status(404).json({ error: 'Experience not found' });
    const applicant = await prisma.applicant.findUnique({ where: { id: req.user.sub } });
    if (applicant && applicant.submissionStatus === 'SUBMITTED') {
      return res.status(400).json({ error: 'Application already submitted, edits not allowed' });
    }
    await prisma.experience.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete experience error', error);
    res.status(500).json({ error: 'Unable to delete experience', detail: error.message });
  }
});

// Upload profile picture
app.post('/upload/profile', authenticate, upload.single('file'), async (req, res) => {
  try {
    const applicant = await prisma.applicant.findUnique({ where: { id: req.user.sub } });
    if (!applicant) return res.status(404).json({ error: 'Applicant not found' });
    if (applicant.submissionStatus === 'SUBMITTED') {
      return res.status(400).json({ error: 'Application already submitted, edits not allowed' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const mime = req.file.mimetype || '';
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files allowed' });
    }
    const userId = req.user.sub;
    const base = await ensureUserFolders(userId);
    const outPath = path.join(base, `profile-${userId}.jpg`);

    let quality = 70;
    let buffer = req.file.buffer;
    for (let i = 0; i < 3; i++) {
      const compressed = await sharp(buffer).jpeg({ quality, mozjpeg: true }).toBuffer();
      if (compressed.length < 150 * 1024) {
        buffer = compressed;
        break;
      }
      quality -= 10;
      buffer = compressed;
    }
    await fs.writeFile(outPath, buffer);
    const url = `/uploads/${userId}/profile-${userId}.jpg`;
    await prisma.applicant.update({
      where: { id: userId },
      data: { urlProfilePic: url }
    });
    res.json({ url });
  } catch (error) {
    console.error('Profile upload error', error);
    res.status(500).json({ error: 'Unable to upload profile picture', detail: error.message });
  }
});

// Upload CV (pdf)
app.post('/upload/cv', authenticate, upload.single('file'), async (req, res) => {
  try {
    const applicant = await prisma.applicant.findUnique({ where: { id: req.user.sub } });
    if (!applicant) return res.status(404).json({ error: 'Applicant not found' });
    if (applicant.submissionStatus === 'SUBMITTED') {
      return res.status(400).json({ error: 'Application already submitted, edits not allowed' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const mime = req.file.mimetype || '';
    if (mime !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF allowed' });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'PDF must be <= 5MB' });
    }
    const userId = req.user.sub;
    const base = await ensureUserFolders(userId);
    const outPath = path.join(base, `cv-${userId}.pdf`);
    await fs.writeFile(outPath, req.file.buffer);
    const url = `/uploads/${userId}/cv-${userId}.pdf`;
    await prisma.applicant.update({ where: { id: userId }, data: { urlCv: url } });
    res.json({ url });
  } catch (error) {
    console.error('CV upload error', error);
    res.status(500).json({ error: 'Unable to upload CV', detail: error.message });
  }
});

// Upload Academic Certificates (pdf)
app.post('/upload/academic', authenticate, upload.single('file'), async (req, res) => {
  try {
    const applicant = await prisma.applicant.findUnique({ where: { id: req.user.sub } });
    if (!applicant) return res.status(404).json({ error: 'Applicant not found' });
    if (applicant.submissionStatus === 'SUBMITTED') {
      return res.status(400).json({ error: 'Application already submitted, edits not allowed' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const mime = req.file.mimetype || '';
    if (mime !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF allowed' });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'PDF must be <= 5MB' });
    }
    const userId = req.user.sub;
    const base = await ensureUserFolders(userId);
    const qualDir = path.join(base, 'qualifications');
    await fs.mkdir(qualDir, { recursive: true });
    const outPath = path.join(qualDir, `academic-${userId}.pdf`);
    await fs.writeFile(outPath, req.file.buffer);
    const url = `/uploads/${userId}/qualifications/academic-${userId}.pdf`;
    await prisma.applicant.update({ where: { id: userId }, data: { urlAcademicCerts: url } });
    res.json({ url });
  } catch (error) {
    console.error('Academic upload error', error);
    res.status(500).json({ error: 'Unable to upload academic documents', detail: error.message });
  }
});

// Upload Experience Certificates (pdf)
app.post('/upload/experience', authenticate, upload.single('file'), async (req, res) => {
  try {
    const applicant = await prisma.applicant.findUnique({ where: { id: req.user.sub } });
    if (!applicant) return res.status(404).json({ error: 'Applicant not found' });
    if (applicant.submissionStatus === 'SUBMITTED') {
      return res.status(400).json({ error: 'Application already submitted, edits not allowed' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const mime = req.file.mimetype || '';
    if (mime !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF allowed' });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'PDF must be <= 5MB' });
    }
    const userId = req.user.sub;
    const base = await ensureUserFolders(userId);
    const expDir = path.join(base, 'experiences');
    await fs.mkdir(expDir, { recursive: true });
    const outPath = path.join(expDir, `experience-${userId}.pdf`);
    await fs.writeFile(outPath, req.file.buffer);
    const url = `/uploads/${userId}/experiences/experience-${userId}.pdf`;
    await prisma.applicant.update({ where: { id: userId }, data: { urlExperienceCerts: url } });
    res.json({ url });
  } catch (error) {
    console.error('Experience upload error', error);
    res.status(500).json({ error: 'Unable to upload experience documents', detail: error.message });
  }
});

// Upload CNIC (image)
app.post('/upload/cnic', authenticate, upload.single('file'), async (req, res) => {
  try {
    const applicant = await prisma.applicant.findUnique({ where: { id: req.user.sub } });
    if (!applicant) return res.status(404).json({ error: 'Applicant not found' });
    if (applicant.submissionStatus === 'SUBMITTED') {
      return res.status(400).json({ error: 'Application already submitted, edits not allowed' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const mime = req.file.mimetype || '';
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files allowed' });
    }
    const userId = req.user.sub;
    const base = await ensureUserFolders(userId);
    const outPath = path.join(base, `cnic-${userId}.jpg`);

    let quality = 70;
    let buffer = req.file.buffer;
    for (let i = 0; i < 3; i++) {
      const compressed = await sharp(buffer).jpeg({ quality, mozjpeg: true }).toBuffer();
      if (compressed.length < 150 * 1024) {
        buffer = compressed;
        break;
      }
      quality -= 10;
      buffer = compressed;
    }
    await fs.writeFile(outPath, buffer);
    const url = `/uploads/${userId}/cnic-${userId}.jpg`;
    await prisma.applicant.update({ where: { id: userId }, data: { urlCnic: url } });
    res.json({ url });
  } catch (error) {
    console.error('CNIC upload error', error);
    res.status(500).json({ error: 'Unable to upload CNIC', detail: error.message });
  }
});

async function start() {
  try {
    await prisma.$connect();
    app.listen(port, () => {
      console.log(`API server listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

start();
