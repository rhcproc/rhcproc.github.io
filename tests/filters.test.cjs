const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const data = JSON.parse(fs.readFileSync('projects.json', 'utf8'));
const contributionData = JSON.parse(fs.readFileSync('contributions.json', 'utf8'));
const entries = [...contributionData, ...data];

function setup() {
  const location = new URL('https://example.com/?category=software&ref=cv');
  const grid = { replaceChildren(...cards) { this.cards = cards; this.headings = []; },
    querySelectorAll() { return this.headings; } };
  const context = vm.createContext({
    URL, URLSearchParams,
    document: { createElement() { return { dataset: {}, querySelector() { return { append() {}, addEventListener() {} }; } }; }, querySelector(selector) {
      if (selector === '.starfield') return { getContext() { return {}; } };
      if (selector === '[data-project-grid]') return grid;
      return null;
    } },
    window: { location, matchMedia: () => ({ matches: true }), history: {
      pushState(_state, _title, url) { context.window.location = new URL(url, context.window.location); }
    } },
    data, contributionData, grid
  });
  vm.runInContext(fs.readFileSync('script.js', 'utf8').replace(/initialize\(\);\s*$/, ''), context);
  vm.runInContext(`
    projects = Object.fromEntries(data.map(normalizeProject).map((p, i) => [p.id, {...p, number: i + 1}]));
    projectCards = data.map(p => ({ dataset: { projectCard: p.id }, querySelector() { return {}; }, before(heading) { grid.headings.push(heading); } }));
    contributions = Object.fromEntries(contributionData.map(normalizeContribution).map(p => [p.id, p]));
    contributionCards = contributionData.map(p => ({ dataset: { contributionCard: p.id }, before(heading) { grid.headings.push(heading); } }));
    applySkillFilter = function(skill) { selectedSkill = skill; };
  `, context);
  return { context, grid, run: code => vm.runInContext(code, context) };
}

test('projects and compact contributions are stored separately', () => {
  assert.equal(new Set(entries.map(p => p.id)).size, entries.length);
  assert.ok(data.every(p => p.type !== 'open-source-contribution'));
  for (const p of entries) {
    assert.ok(p.categories.length);
    assert.ok(p.categories.every(c => ['software', 'ai', 'blockchain', 'research'].includes(c)));
  }
  for (const p of contributionData) {
    assert.deepEqual(Object.keys(p).sort(), ['id', 'date', 'categories', 'title', 'organization', 'tags', 'summary', 'links'].sort());
  }
  assert.deepEqual(contributionData.find(p => p.id === 'ibm-mas-cli').categories, ['software']);
});

test('category and stack intersect, including empty results and category-scoped counts', () => {
  const { run } = setup();
  for (const category of ['all', 'software', 'ai', 'blockchain', 'research']) {
    for (const skill of ['All', 'Python', 'Solidity', 'IBM MAS']) {
      run(`selectedCategory = ${JSON.stringify(category)}`);
      const actual = run(`getCardsMatchingSkill(${JSON.stringify(skill)}).map(c => c.dataset.contributionCard || c.dataset.projectCard)`);
      const expected = entries.filter(p => (category === 'all' || p.categories.includes(category)) && (skill === 'All' || (p.stack || p.tags || []).includes(skill))).map(p => p.id);
      assert.deepEqual(Array.from(actual), expected);
    }
    assert.equal(run('getOverlapCount("All", [])'), entries.filter(p => category === 'all' || p.categories.includes(category)).length);
  }
});

test('URL selection ranks IBM first, preserves stack and unrelated parameters, and restores All order', () => {
  const { run, context, grid } = setup();
  run('selectedSkill = "Python"; syncCategoryFromUrl()');
  assert.equal(run('selectedCategory'), 'software');
  assert.equal(run('selectedSkill'), 'Python');
  assert.equal(grid.cards[0].dataset.contributionCard, 'ibm-mas-cli');
  run('selectCategory("ai")');
  assert.equal(context.window.location.search, '?category=ai&ref=cv');
  run('selectCategory("all")');
  assert.equal(context.window.location.search, '?category=all&ref=cv');
  assert.deepEqual(Array.from(grid.cards, c => c.dataset.contributionCard || c.dataset.projectCard), entries.map(p => p.id));
  context.window.location = new URL('https://example.com/?category=unknown');
  run('syncCategoryFromUrl()');
  assert.equal(run('selectedCategory'), 'software');
});

test('project navigation retains category query', () => {
  const { run, context } = setup();
  run('renderProjectModal = function() {}; openProject("factoryflow")');
  assert.match(context.window.location.pathname, /^\/proj\/\d+$/);
  assert.equal(context.window.location.search, '?category=software&ref=cv');
});

test('contributions have their own section and never enter project modal navigation', () => {
  const { run, grid } = setup();
  run('syncCategoryFromUrl()');
  assert.deepEqual(grid.headings.map(h => h.dataset.projectGroup), ['open-source-contribution', 'project']);
  assert.equal(run('projectOrder.includes("ibm-mas-cli")'), false);
  assert.equal(run('projects["ibm-mas-cli"]'), undefined);
  assert.equal(run('contributions["ibm-mas-cli"].tags.join(" · ")'), 'Python · CLI · Bug Fix');
});

 test('blockchain contributions follow category and tag filters', () => {
  const { run } = setup();
  run(`contributions.example = normalizeContribution({id: 'example', categories: ['blockchain'], tags: ['Solidity']}, 0);
       contributionCards.push({dataset: {contributionCard: 'example'}});`);
  for (const category of ['software', 'blockchain', 'all', 'ai']) {
    run(`selectedCategory = "${category}"`);
    assert.equal(run('getCardsMatchingSkill("Solidity").some(c => c.dataset.contributionCard === "example")'), ['blockchain', 'all'].includes(category));
  }
});

test('root defaults to software without rewriting the URL; explicit categories work', () => {
  const { run, context } = setup();
  for (const category of [null, 'software', 'all', 'ai', 'blockchain', 'research']) {
    const url = 'https://example.com/' + (category ? '?category=' + category : '');
    context.window.location = new URL(url);
    run('syncCategoryFromUrl()');
    assert.equal(run('selectedCategory'), category || 'software');
    assert.equal(context.window.location.href, url);
  }
  assert.equal(run('contributionsExpanded'), true);
});
