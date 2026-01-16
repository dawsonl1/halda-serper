const axios = require('axios');

const SERPER_API_KEY = process.env.SERPER_API_KEY;

exports.renderSearchPage = (req, res) => {
  res.render('index');
};

function getDomainRootFromUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const parts = host.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return host;
  } catch (e) {
    return null;
  }
}

function parseQuestions(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const questions = [];
  let currentQuestion = null;

  // Explicitly ignored question codes per instructions
  const ignoredQuestionCodes = new Set(['Q1', 'Q2', 'Q3', 'Q4', 'Q10']);

  const questionRegex = /^Q(\d+):\s*(.+)$/;
  const optionRegex = /^Q(\d+)([A-Z]+):\s*(.+)$/;

  for (const line of lines) {
    const questionMatch = line.match(questionRegex);
    if (questionMatch) {
      const code = `Q${questionMatch[1]}`;
      const text = questionMatch[2].trim();

      // Ignore only explicit codes like Q1–Q4, Q10. All others are included.
      const ignored = ignoredQuestionCodes.has(code);

      currentQuestion = {
        code,
        text,
        type: 'open response',
        options: [],
        ignored,
      };

      if (!ignored) {
        questions.push(currentQuestion);
      }

      continue;
    }

    const optionMatch = line.match(optionRegex);
    if (optionMatch && currentQuestion && !currentQuestion.ignored) {
      const qDigits = optionMatch[1];
      const optionCode = `Q${qDigits}${optionMatch[2]}`;
      const label = optionMatch[3].trim();

      currentQuestion.type = 'multiple choice';
      currentQuestion.options.push({ code: optionCode, label });
      continue;
    }

    // Ignore all other lines (system IDs like Qcmj...:, free text, etc.)
  }

  // Strip helper flag before returning
  return questions.map((q) => ({
    code: q.code,
    text: q.text,
    type: q.type,
    options: q.options,
  }));
}

async function searchTopResults(
  schoolName,
  optionLabel,
  audience,
  universityDomainRoot,
  queryOverride
) {
  const parts = [schoolName, audience, optionLabel].filter(Boolean);
  const query = (queryOverride && queryOverride.trim().length > 0)
    ? queryOverride.trim()
    : parts.join(' ').trim();

  const response = await axios.post(
    'https://google.serper.dev/search',
    { q: query },
    {
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = response.data || {};
  let organic = Array.isArray(data.organic) ? data.organic : [];

  const enforceDomain =
    !queryOverride || (typeof queryOverride === 'string' && queryOverride.trim().length === 0);

  if (enforceDomain && universityDomainRoot) {
    organic = organic.filter((item) => {
      const root = getDomainRootFromUrl(item.link);
      return root && root === universityDomainRoot;
    });
  }

  return organic.slice(0, 5).map((item) => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet,
  }));
}

exports.parse = (req, res) => {
  try {
    console.log('parse endpoint req.body:', JSON.stringify(req.body));
    console.log('parse endpoint content-type:', req.headers['content-type']);
    // Be defensive about how the body may look when coming through
    // Lambda + API Gateway + serverless-http. Support all of:
    // - { rawText: "..." }
    // - { body: { rawText: "..." } }
    // - { body: "..." }
    // - plain string "...".
    let rawText = null;

    const body = req.body;

    if (body && typeof body === 'object') {
      if ('rawText' in body) {
        rawText = body.rawText;
      } else if ('body' in body) {
        const inner = body.body;
        if (inner && typeof inner === 'object' && 'rawText' in inner) {
          rawText = inner.rawText;
        } else if (typeof inner === 'string') {
          rawText = inner;
        }
      }
    } else if (typeof body === 'string') {
      rawText = body;
    }

    // As a final fallback, inspect the original API Gateway event body
    // (available via serverless-http) in case req.body was not
    // deserialized as expected.
    if (!rawText && req.apiGateway && req.apiGateway.event) {
      const eventBody = req.apiGateway.event.body;
      if (eventBody && typeof eventBody === 'string') {
        try {
          const parsed = JSON.parse(eventBody);
          if (parsed && typeof parsed.rawText === 'string') {
            rawText = parsed.rawText;
          } else {
            rawText = eventBody;
          }
        } catch (e) {
          rawText = eventBody;
        }
      }
    }

    if (!rawText || typeof rawText !== 'string') {
      return res
        .status(400)
        .json({ error: 'Missing or invalid "rawText" in request body.' });
    }

    const questions = parseQuestions(rawText);
    res.json({ questions });
  } catch (error) {
    console.error('Error parsing questions:', error.message || error);
    res.status(500).json({ error: 'Failed to parse questions.' });
  }
};

exports.searchSelected = async (req, res) => {
  try {
    if (!SERPER_API_KEY) {
      return res
        .status(500)
        .json({ error: 'SERPER_API_KEY environment variable is not set.' });
    }
    console.log('searchSelected req.body:', JSON.stringify(req.body));
    console.log('searchSelected content-type:', req.headers['content-type']);

    // Similar to parse, be defensive about how the body is shaped.
    let schoolName = null;
    let universityWebsite = null;
    let selections = null;

    const body = req.body;

    if (body && typeof body === 'object') {
      if (typeof body.schoolName === 'string') {
        schoolName = body.schoolName;
      }
      if (typeof body.universityWebsite === 'string') {
        universityWebsite = body.universityWebsite;
      }
      if (Array.isArray(body.selections)) {
        selections = body.selections;
      }
    }

    // Fallback: inspect raw API Gateway event body if values are missing.
    if ((!schoolName || !selections) && req.apiGateway && req.apiGateway.event) {
      const eventBody = req.apiGateway.event.body;
      if (eventBody && typeof eventBody === 'string') {
        try {
          const parsed = JSON.parse(eventBody);
          if (!schoolName && typeof parsed.schoolName === 'string') {
            schoolName = parsed.schoolName;
          }
          if (!universityWebsite && typeof parsed.universityWebsite === 'string') {
            universityWebsite = parsed.universityWebsite;
          }
          if (!selections && Array.isArray(parsed.selections)) {
            selections = parsed.selections;
          }
        } catch (e) {
          // ignore parse failure, we'll validate below
        }
      }
    }

    if (!schoolName || typeof schoolName !== 'string') {
      return res
        .status(400)
        .json({ error: 'Missing or invalid "schoolName" in request body.' });
    }

    if (!Array.isArray(selections) || selections.length === 0) {
      return res
        .status(400)
        .json({ error: 'No selected answers were provided.' });
    }

    const results = [];

    const universityDomainRoot =
      typeof universityWebsite === 'string' && universityWebsite.trim().length > 0
        ? getDomainRootFromUrl(universityWebsite.trim())
        : null;

    for (const sel of selections) {
      const label = sel?.label;
      if (!label || typeof label !== 'string') {
        // Skip invalid entries rather than failing the whole request
        continue;
      }

      const audience =
        typeof sel?.audience === 'string' && sel.audience.trim().length > 0
          ? sel.audience.trim()
          : '';

      const queryOverride =
        typeof sel?.queryOverride === 'string' && sel.queryOverride.trim().length > 0
          ? sel.queryOverride.trim()
          : null;

      try {
        const topResults = await searchTopResults(
          schoolName,
          label,
          audience,
          universityDomainRoot,
          queryOverride
        );
        const primary = topResults[0] || null;
        results.push({
          questionCode: sel.questionCode,
          optionCode: sel.optionCode,
          label,
          audience: audience || null,
          url: primary ? primary.url : null,
          options: topResults,
        });
      } catch (err) {
        console.error(
          'Error searching for selection',
          label,
          err?.response?.data || err.message || err
        );
        results.push({
          questionCode: sel.questionCode,
          optionCode: sel.optionCode,
          label,
          url: null,
          options: [],
        });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Error handling selected search:', error?.response?.data || error.message || error);
    const status = error?.response?.status || 500;
    res.status(status).json({
      error: 'Failed to process selected search requests.',
      details: error?.response?.data || null,
    });
  }
};
