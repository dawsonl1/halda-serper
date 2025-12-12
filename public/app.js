const form = document.getElementById('search-form');
const universityWebsiteInput = document.getElementById('universityWebsite');
const schoolNameInput = document.getElementById('schoolName');
const rawTextInput = document.getElementById('rawText');
const statusEl = document.getElementById('status');
const searchStatusEl = document.getElementById('search-status');
const parsedCard = document.getElementById('parsed-card');
const parsedQuestionsEl = document.getElementById('parsed-questions');
const runSerperButton = document.getElementById('run-serper');
const finalCard = document.getElementById('final-card');
const finalCopyEl = document.getElementById('final-copy');
const finalToolsEl = document.getElementById('final-tools');
const rerunModal = document.getElementById('rerun-modal');
const rerunQueryInput = document.getElementById('rerun-query');
const rerunCancelButton = document.getElementById('rerun-cancel');
const rerunConfirmButton = document.getElementById('rerun-confirm');

let lastParsedQuestions = [];
let currentSchoolName = '';
let currentUniversityWebsite = '';
let lastSearchResults = [];
let rerunResultIndex = null;

const audienceOptions = [
  { value: '', label: 'Any audience' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'graduate', label: 'Graduate' },
  { value: 'adult', label: 'Adult / Working Professional' },
  { value: 'online', label: 'Online Student' },
  { value: 'international', label: 'International' },
];

const BUILT_IN_AUDIENCE_VALUES = new Set(
  audienceOptions.map((a) => a.value)
);

const AUDIENCE_STORAGE_KEY = 'serper:audience-options:v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Load any stored custom audiences (pruned to the last 24 hours)
loadStoredAudiences();

function setStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.className = `status status--${type}`;
}

function setSearchStatus(message, type = 'info') {
  if (!searchStatusEl) return;
  searchStatusEl.textContent = message;
  searchStatusEl.className = `status status--${type}`;
}

function showElement(el) {
  el.classList.remove('hidden');
}

function hideElement(el) {
  el.classList.add('hidden');
}

function openRerunModal(resultIndex) {
  const result = lastSearchResults[resultIndex];
  if (!result) return;

  const audiencePart = result.audience || '';
  const parts = [currentSchoolName, audiencePart, result.label].filter(Boolean);
  rerunQueryInput.value = parts.join(' ');
  rerunResultIndex = resultIndex;

  rerunModal.classList.remove('hidden');
  rerunModal.setAttribute('aria-hidden', 'false');
  rerunQueryInput.focus();
}

function closeRerunModal() {
  rerunModal.classList.add('hidden');
  rerunModal.setAttribute('aria-hidden', 'true');
  rerunResultIndex = null;
}

function getExistingResultKeys() {
  return new Set(
    (lastSearchResults || []).map(
      (r) => `${r.questionCode || ''}::${r.optionCode || ''}`
    )
  );
}

function updateRunSerperButtonState() {
  if (!runSerperButton) return;

  const selectedCheckboxes = parsedQuestionsEl.querySelectorAll(
    '.answer-checkbox:checked'
  );

  if (selectedCheckboxes.length === 0) {
    runSerperButton.textContent = 'Run Serper Search for Selected Answers';
    runSerperButton.classList.remove('button--partial');
    return;
  }

  const selected = Array.from(selectedCheckboxes).map((cb) => {
    const questionCode = cb.dataset.questionCode || '';
    const optionCode = cb.dataset.optionCode || '';

    const answerAudienceEl = parsedQuestionsEl.querySelector(
      `.audience-select--small[data-question-code="${questionCode}"][data-option-code="${optionCode}"]`
    );
    const questionAudienceEl = parsedQuestionsEl.querySelector(
      `.audience-select[data-question-code="${questionCode}"]:not(.audience-select--small)`
    );

    const answerAudience = answerAudienceEl?.classList.contains('hidden')
      ? ''
      : answerAudienceEl?.value || '';
    const questionAudience = questionAudienceEl?.value || '';
    const audience = answerAudience || questionAudience;

    return { questionCode, optionCode, audience };
  });

  const existingByKey = new Map();
  (lastSearchResults || []).forEach((r) => {
    const key = `${r.questionCode || ''}::${r.optionCode || ''}`;
    existingByKey.set(key, r);
  });

  const pendingKeys = new Set();
  const newCount = selected.filter((sel) => {
    const key = `${sel.questionCode}::${sel.optionCode}`;
    const existing = existingByKey.get(key);
    if (!existing) {
      pendingKeys.add(key);
      return true;
    }
    const prevAudience = existing.audience || '';
    const currentAudience = sel.audience || '';
    const needsRerun = prevAudience !== currentAudience;
    if (needsRerun) pendingKeys.add(key);
    return needsRerun;
  }).length;

  // Visually mark parsed answer rows that will be rerun next time
  const allAnswerRows = parsedQuestionsEl.querySelectorAll('.answer-select-row');
  allAnswerRows.forEach((row) => {
    const cb = row.querySelector('.answer-checkbox');
    if (!cb) return;
    const q = cb.dataset.questionCode || '';
    const o = cb.dataset.optionCode || '';
    const key = `${q}::${o}`;

    if (cb.checked && pendingKeys.has(key)) {
      row.classList.add('answer-select-row--pending');
    } else {
      row.classList.remove('answer-select-row--pending');
    }
  });

  if ((lastSearchResults || []).length > 0 && newCount > 0) {
    const label = newCount === 1
      ? 'Run Search For 1 New Answer'
      : `Run Search For ${newCount} New Answers`;
    runSerperButton.textContent = label;
    runSerperButton.classList.add('button--partial');
  } else {
    runSerperButton.textContent = 'Run Serper Search for Selected Answers';
    runSerperButton.classList.remove('button--partial');
  }
}

function loadStoredAudiences() {
  try {
    const raw = window.localStorage.getItem(AUDIENCE_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const now = Date.now();
    const fresh = parsed.filter((item) =>
      typeof item === 'object' &&
      item &&
      typeof item.value === 'string' &&
      typeof item.label === 'string' &&
      typeof item.addedAt === 'number' &&
      now - item.addedAt < ONE_DAY_MS
    );

    fresh.forEach((item) => {
      if (!audienceOptions.find((a) => a.value === item.value)) {
        audienceOptions.push({ value: item.value, label: item.label });
      }
    });

    const cleaned = fresh.map((item) => ({
      value: item.value,
      label: item.label,
      addedAt: item.addedAt,
    }));
    window.localStorage.setItem(AUDIENCE_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (e) {
    // Ignore storage errors
  }
}

function persistCustomAudiences() {
  try {
    const now = Date.now();
    const customs = audienceOptions
      .filter((a) => !BUILT_IN_AUDIENCE_VALUES.has(a.value))
      .map((a) => ({ value: a.value, label: a.label, addedAt: now }));

    window.localStorage.setItem(AUDIENCE_STORAGE_KEY, JSON.stringify(customs));
  } catch (e) {
    // Ignore storage errors
  }
}

function populateAudienceSelect(select) {
  audienceOptions.forEach((a) => {
    const opt = document.createElement('option');
    opt.value = a.value;
    opt.textContent = a.label;
    select.appendChild(opt);
  });

  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = 'Custom audience...';
  select.appendChild(customOpt);

  attachAudienceSelectBehavior(select);
}

function ensureAudienceOptionOnSelect(select, value, label) {
  const existing = Array.from(select.options).find((o) => o.value === value);
  if (existing) {
    existing.textContent = label;
    return;
  }

  const customOption = Array.from(select.options).find((o) => o.value === '__custom__');
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;

  if (customOption && customOption.parentNode === select) {
    select.insertBefore(opt, customOption);
  } else {
    select.appendChild(opt);
  }
}

function normalizeAudienceValue(label) {
  const trimmed = label.trim();
  if (!trimmed) return '';
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

function attachAudienceSelectBehavior(select) {
  select.dataset.prevValue = select.value || '';

  select.addEventListener('focus', () => {
    select.dataset.prevValue = select.value || '';
  });

  select.addEventListener('change', () => {
    if (select.value !== '__custom__') {
      select.dataset.prevValue = select.value || '';
      // Any audience change can affect whether we need to rerun searches
      updateRunSerperButtonState();
      return;
    }

    const previousValue = select.dataset.prevValue || '';
    const label = window.prompt('Enter a custom audience label:');

    if (!label) {
      select.value = previousValue;
      return;
    }

    const value = normalizeAudienceValue(label) || label.trim();
    if (!value) {
      select.value = previousValue;
      return;
    }

    const existing = audienceOptions.find((a) => a.value === value);
    if (!existing) {
      audienceOptions.push({ value, label: label.trim() });
      persistCustomAudiences();
    }

    const allSelects = document.querySelectorAll('.audience-select');
    allSelects.forEach((sel) => {
      ensureAudienceOptionOnSelect(sel, value, label.trim());
    });

    select.value = value;
    select.dataset.prevValue = value;

    // Custom audience added/selected can also affect rerun state
    updateRunSerperButtonState();
  });

  // Also watch for any checkbox changes within the parsed area (safety net)
  parsedQuestionsEl.addEventListener('change', (event) => {
    if (
      event.target.classList.contains('answer-checkbox') ||
      event.target.classList.contains('question-checkbox')
    ) {
      updateRunSerperButtonState();
    }
  });

  // Initial state of the Run Serper button
  updateRunSerperButtonState();
}

function renderParsedQuestions(questions) {
  parsedQuestionsEl.innerHTML = '';

  if (!questions || questions.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No questions were parsed from the input.';
    empty.className = 'text-muted';
    parsedQuestionsEl.appendChild(empty);
    return;
  }

  questions.forEach((q) => {
    if (!q.options || q.options.length === 0) {
      return;
    }

    const block = document.createElement('div');
    block.className = 'question-block';

    const questionHeader = document.createElement('div');
    questionHeader.className = 'question-header';

    const qCheckbox = document.createElement('input');
    qCheckbox.type = 'checkbox';
    qCheckbox.className = 'question-checkbox';
    qCheckbox.dataset.questionCode = q.code;

    const title = document.createElement('span');
    title.className = 'question-title';
    title.textContent = q.text;

    const audienceSelect = document.createElement('select');
    audienceSelect.className = 'audience-select';
    audienceSelect.dataset.questionCode = q.code;

    populateAudienceSelect(audienceSelect);

    const advancedToggle = document.createElement('button');
    advancedToggle.type = 'button';
    advancedToggle.className = 'link-toggle';
    advancedToggle.textContent = 'Advanced audience per answer';

    const applyAllButton = document.createElement('button');
    applyAllButton.type = 'button';
    applyAllButton.className = 'apply-all-button hidden';
    applyAllButton.textContent = 'Apply to all answers';

    const controls = document.createElement('div');
    controls.className = 'question-controls';
    // Order: apply-all on the left, advanced toggle on the right
    controls.appendChild(applyAllButton);
    controls.appendChild(advancedToggle);

    questionHeader.appendChild(qCheckbox);
    questionHeader.appendChild(title);
    questionHeader.appendChild(audienceSelect);
    questionHeader.appendChild(controls);
    block.appendChild(questionHeader);

    const answersList = document.createElement('ul');
    answersList.className = 'answers-list';

    q.options.forEach((opt) => {
      const li = document.createElement('li');
      li.className = 'answer-select-row';

      const aCheckbox = document.createElement('input');
      aCheckbox.type = 'checkbox';
      aCheckbox.className = 'answer-checkbox';
      aCheckbox.dataset.questionCode = q.code;
      aCheckbox.dataset.optionCode = opt.code;
      aCheckbox.dataset.label = opt.label;

      const label = document.createElement('span');
      label.textContent = opt.label;

      const answerAudience = document.createElement('select');
      answerAudience.className = 'audience-select audience-select--small hidden';
      answerAudience.dataset.questionCode = q.code;
      answerAudience.dataset.optionCode = opt.code;

      populateAudienceSelect(answerAudience);

      li.appendChild(aCheckbox);
      li.appendChild(label);
      li.appendChild(answerAudience);
      answersList.appendChild(li);
    });

    block.appendChild(answersList);
    parsedQuestionsEl.appendChild(block);

    // Question checkbox controls all answers
    qCheckbox.addEventListener('change', () => {
      const checked = qCheckbox.checked;
      const answerCheckboxes = block.querySelectorAll('.answer-checkbox');
      answerCheckboxes.forEach((cb) => {
        cb.checked = checked;
      });
      updateRunSerperButtonState();
    });

    // Answer checkboxes influence question checkbox
    const answerCheckboxes = block.querySelectorAll('.answer-checkbox');
    answerCheckboxes.forEach((cb) => {
      cb.addEventListener('change', () => {
        const allChecked = Array.from(answerCheckboxes).every((c) => c.checked);
        const noneChecked = Array.from(answerCheckboxes).every((c) => !c.checked);
        qCheckbox.checked = allChecked;
        qCheckbox.indeterminate = !allChecked && !noneChecked;

        // If this row is being unchecked, immediately clear the pending
        // highlight so the purple bar disappears without waiting on the
        // aggregated state logic.
        if (!cb.checked) {
          const row = cb.closest('.answer-select-row');
          if (row) {
            row.classList.remove('answer-select-row--pending');
          }
        }

        updateRunSerperButtonState();
      });
    });

    // Clicking anywhere on an answer row toggles its checkbox
    const answerRows = block.querySelectorAll('.answer-select-row');
    answerRows.forEach((row) => {
      row.addEventListener('click', (event) => {
        const target = event.target;
        if (target.closest('input[type="checkbox"]') || target.closest('select')) {
          return;
        }

        const checkbox = row.querySelector('.answer-checkbox');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });

    let advancedHasBeenOpened = false;

    const updateApplyAllVisibility = () => {
      const questionAudienceValue = audienceSelect.value;
      const answerSelects = block.querySelectorAll('.audience-select--small');

      const advancedOpen = Array.from(answerSelects).some(
        (el) => !el.classList.contains('hidden')
      );

      const hasDifference = Array.from(answerSelects).some(
        (el) => el.value !== questionAudienceValue
      );

      // Only show Apply-to-all after advanced controls have been opened
      // at least once, and when there are differences while advanced is open.
      const canApply = advancedHasBeenOpened && advancedOpen && hasDifference;

      if (canApply) {
        applyAllButton.classList.remove('hidden');
      } else {
        applyAllButton.classList.add('hidden');
      }
    };

    // Advanced toggle: show/hide per-answer audience selects for this question
    advancedToggle.addEventListener('click', () => {
      const answerSelects = block.querySelectorAll('.audience-select--small');
      const anyHidden = Array.from(answerSelects).some((el) =>
        el.classList.contains('hidden')
      );

      if (anyHidden) {
        const questionAudienceValue = audienceSelect.value;

        // On the very first open, if a general audience is set, propagate it
        // to all per-answer dropdowns automatically.
        if (!advancedHasBeenOpened && questionAudienceValue) {
          answerSelects.forEach((el) => {
            el.value = questionAudienceValue;
            el.classList.remove('hidden');
          });
        } else {
          // Subsequent opens just reveal existing per-answer selections.
          answerSelects.forEach((el) => {
            el.classList.remove('hidden');
          });
        }

        advancedHasBeenOpened = true;
        advancedToggle.textContent = 'Hide advanced audience controls';
      } else {
        // Hide advanced controls
        answerSelects.forEach((el) => {
          el.classList.add('hidden');
        });
        advancedToggle.textContent = 'Advanced audience per answer';
      }

      updateApplyAllVisibility();
    });

    // Apply-to-all button: copy the question-level audience into all per-answer selects
    applyAllButton.addEventListener('click', () => {
      const questionAudienceValue = audienceSelect.value;
      const answerSelects = block.querySelectorAll('.audience-select--small');

      answerSelects.forEach((el) => {
        el.classList.remove('hidden');
        el.value = questionAudienceValue;
      });

      advancedToggle.textContent = 'Hide advanced audience controls';
      updateApplyAllVisibility();
    });

    // Keep apply-all visibility in sync with changes to the simple (question-level) dropdown
    audienceSelect.addEventListener('change', updateApplyAllVisibility);

    // Initial visibility state
    updateApplyAllVisibility();
  });
}

function renderFinalResults(results, newResultKeys = new Set()) {
  // Capture existing dropdown selections keyed by questionCode+optionCode
  const previousSelections = new Map();
  finalToolsEl.querySelectorAll('.link-tools-row').forEach((row) => {
    const q = row.dataset.questionCode || '';
    const o = row.dataset.optionCode || '';
    const select = row.querySelector('.link-select');
    if (!q || !o || !select) return;
    const key = `${q}::${o}`;
    previousSelections.set(key, select.value || '');
  });

  lastSearchResults = results;
  finalCopyEl.innerHTML = '';
  finalToolsEl.innerHTML = '';

  if (!results || results.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No results to display.';
    empty.className = 'text-muted';
    finalCopyEl.appendChild(empty);
    return;
  }

  // Copy-ready lines (no NEW badge here)
  results.forEach((r, index) => {
    const line = document.createElement('div');
    line.className = 'answer-line';
    line.dataset.resultIndex = String(index);

    const label = document.createElement('span');
    label.className = 'answer-label';
    label.textContent = `${r.label}:`;

    const urlSpan = document.createElement('span');
    urlSpan.className = 'answer-url';
    urlSpan.textContent = r.url ? ` ${r.url}` : ' No results found.';

    line.appendChild(label);
    line.appendChild(urlSpan);
    finalCopyEl.appendChild(line);
  });

  // Optional tools below for preview / alternate link selection
  results.forEach((r, index) => {
    if (!Array.isArray(r.options) || r.options.length === 0) {
      return;
    }

    const row = document.createElement('div');
    row.className = 'link-tools-row';
    row.dataset.questionCode = r.questionCode || '';
    row.dataset.optionCode = r.optionCode || '';

    const rowKey = `${r.questionCode || ''}::${r.optionCode || ''}`;
    const isNew = newResultKeys.has(rowKey);

    if (isNew) {
      row.classList.add('link-tools-row--new');
    }

    const label = document.createElement('span');
    label.className = 'answer-label';
    label.textContent = r.label;

    const reloadButton = document.createElement('button');
    reloadButton.type = 'button';
    reloadButton.className = 'link-reload-button';
    reloadButton.title = 'Re-run search for this answer';
    reloadButton.textContent = '⟳';

    const select = document.createElement('select');
    select.className = 'link-select';

    const key = `${r.questionCode || ''}::${r.optionCode || ''}`;
    const savedValue = previousSelections.get(key) || '';

    r.options.forEach((opt, optIndex) => {
      const optionEl = document.createElement('option');
      optionEl.value = opt.url || '';
      optionEl.textContent = opt.url || '(no URL)';
      if ((savedValue && optionEl.value === savedValue) || (!savedValue && optIndex === 0)) {
        optionEl.selected = true;
      }
      select.appendChild(optionEl);
    });

    select.addEventListener('change', () => {
      const targetLine = finalCopyEl.querySelector(
        `.answer-line[data-result-index="${index}"] .answer-url`
      );
      if (targetLine) {
        const newUrl = select.value || '';
        targetLine.textContent = newUrl ? ` ${newUrl}` : ' No results found.';
      }
    });

    const previewButton = document.createElement('button');
    previewButton.type = 'button';
    previewButton.className = 'button button--ghost button--small';
    previewButton.textContent = 'Preview';

    previewButton.addEventListener('click', () => {
      const url = select.value;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });

    row.appendChild(label);
    row.appendChild(select);
    row.appendChild(previewButton);
    row.appendChild(reloadButton);
    finalToolsEl.appendChild(row);

    reloadButton.addEventListener('click', () => {
      openRerunModal(index);
    });
  });
  // Refresh the Run Serper button label/color based on new results
  updateRunSerperButtonState();
}

async function rerunSingleSearch() {
  if (rerunResultIndex === null || rerunResultIndex < 0) return;

  const base = lastSearchResults[rerunResultIndex];
  if (!base) return;

  const schoolName = currentSchoolName.trim();
  if (!schoolName) {
    setSearchStatus('Please parse again with a valid school name.', 'error');
    return;
  }

  const queryOverride = (rerunQueryInput.value || '').trim();

  setSearchStatus(`Re-running search for "${base.label}"...`, 'loading');

  try {
    const body = {
      schoolName,
      universityWebsite: currentUniversityWebsite || '',
      selections: [
        {
          questionCode: base.questionCode,
          optionCode: base.optionCode,
          label: base.label,
          audience: base.audience || '',
          queryOverride,
        },
      ],
    };

    const response = await axios.post('search-selected', body);
    const { results } = response.data || {};
    const newResult = Array.isArray(results) ? results[0] : null;

    if (newResult) {
      lastSearchResults[rerunResultIndex] = newResult;
      const key = `${newResult.questionCode || ''}::${newResult.optionCode || ''}`;
      const newKeys = new Set([key]);
      renderFinalResults(lastSearchResults, newKeys);
      setSearchStatus('Search complete.', 'success');
    } else {
      setSearchStatus('No results returned for rerun.', 'error');
    }
  } catch (err) {
    console.error(err);
    const message = err?.response?.data?.error || 'Something went wrong while re-running the search.';
    setSearchStatus(message, 'error');
  } finally {
    closeRerunModal();
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const universityWebsite = (universityWebsiteInput?.value || '').trim();
  const schoolName = schoolNameInput.value.trim();
  const rawText = rawTextInput.value.trim();

  if (!schoolName || !rawText) {
    setStatus('Please provide both a school name and Q-coded text.', 'error');
    return;
  }

  setStatus('Parsing questions...', 'loading');
  hideElement(parsedCard);
  hideElement(finalCard);
  parsedQuestionsEl.innerHTML = '';
  finalCopyEl.innerHTML = '';
  finalToolsEl.innerHTML = '';

  try {
    const response = await axios.post('parse', { rawText });
    const { questions } = response.data || {};
    lastParsedQuestions = questions || [];
    currentSchoolName = schoolName;
    currentUniversityWebsite = universityWebsite;

    renderParsedQuestions(lastParsedQuestions);
    showElement(parsedCard);
    setStatus('Questions parsed. Select answers and run the Serper search.', 'success');
  } catch (err) {
    console.error(err);
    const message = err?.response?.data?.error || 'Something went wrong while parsing.';
    setStatus(message, 'error');
  }
});

// Rerun modal wiring
if (rerunCancelButton && rerunConfirmButton && rerunModal) {
  rerunCancelButton.addEventListener('click', () => {
    closeRerunModal();
  });

  rerunConfirmButton.addEventListener('click', () => {
    rerunSingleSearch();
  });

  rerunModal.addEventListener('click', (event) => {
    if (event.target === rerunModal) {
      closeRerunModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !rerunModal.classList.contains('hidden')) {
      closeRerunModal();
    }
  });
}

runSerperButton.addEventListener('click', async () => {
  const schoolName = currentSchoolName.trim();
  if (!schoolName) {
    setSearchStatus('Please parse again with a valid school name.', 'error');
    return;
  }

  const selected = Array.from(
    parsedQuestionsEl.querySelectorAll('.answer-checkbox:checked')
  ).map((cb) => {
    const questionCode = cb.dataset.questionCode;
    const optionCode = cb.dataset.optionCode;
    const label = cb.dataset.label;

    const answerAudienceEl = parsedQuestionsEl.querySelector(
      `.audience-select--small[data-question-code="${questionCode}"][data-option-code="${optionCode}"]`
    );
    const questionAudienceEl = parsedQuestionsEl.querySelector(
      `.audience-select[data-question-code="${questionCode}"]:not(.audience-select--small)`
    );

    const answerAudience = answerAudienceEl?.classList.contains('hidden')
      ? ''
      : answerAudienceEl?.value || '';
    const questionAudience = questionAudienceEl?.value || '';
    const audience = answerAudience || questionAudience;

    return {
      questionCode,
      optionCode,
      label,
      audience,
    };
  });

  if (selected.length === 0) {
    setSearchStatus('Please select at least one answer before running the Serper search.', 'error');
    return;
  }

  // If we already have prior results, only run Serper for answers that
  // either (1) have no prior result or (2) have a different audience
  // than what is currently selected in the UI.
  const existingByKey = new Map();
  (lastSearchResults || []).forEach((r) => {
    const key = `${r.questionCode || ''}::${r.optionCode || ''}`;
    existingByKey.set(key, r);
  });

  const newSelections = selected.filter((sel) => {
    const key = `${sel.questionCode || ''}::${sel.optionCode || ''}`;
    const existing = existingByKey.get(key);
    if (!existing) return true;
    const prevAudience = existing.audience || '';
    const currentAudience = sel.audience || '';
    return prevAudience !== currentAudience;
  });

  if (newSelections.length === 0) {
    setSearchStatus(
      'All selected answers already have search results. Select new answers to run another search.',
      'info'
    );
    return;
  }

  setSearchStatus('Running Serper search for selected answers...', 'loading');

  try {
    const response = await axios.post('search-selected', {
      schoolName,
      universityWebsite: currentUniversityWebsite || '',
      selections: newSelections,
    });
    const { results } = response.data || {};

    const freshResults = Array.isArray(results) ? results : [];

    // Merge new results into any existing ones, keyed by questionCode+optionCode
    const mergedByKey = new Map();

    (lastSearchResults || []).forEach((r) => {
      const key = `${r.questionCode || ''}::${r.optionCode || ''}`;
      mergedByKey.set(key, r);
    });

    freshResults.forEach((r) => {
      const key = `${r.questionCode || ''}::${r.optionCode || ''}`;
      mergedByKey.set(key, r);
    });

    const merged = Array.from(mergedByKey.values());

    const newKeys = new Set(
      freshResults.map(
        (r) => `${r.questionCode || ''}::${r.optionCode || ''}`
      )
    );

    renderFinalResults(merged, newKeys);
    showElement(finalCard);
    setSearchStatus('Search complete.', 'success');

    // Reset Run Serper button to its default label/color after a run
    if (runSerperButton) {
      runSerperButton.textContent = 'Run Serper Search for Selected Answers';
      runSerperButton.classList.remove('button--partial');
    }
  } catch (err) {
    console.error(err);
    const message = err?.response?.data?.error || 'Something went wrong while searching.';
    setSearchStatus(message, 'error');
  }
});
