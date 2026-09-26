const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const data = JSON.parse(fs.readFileSync('projects.json', 'utf8'));

function setup() {
  const location = new URL('https://example.com/?category=software&ref=cv');
  const grid = { append(...cards) { this.cards = cards; } };
  const context = vm.createContext({
    URL, URLSearchParams,
    document: { querySelector(selector) {
      if (selector === '.starfield') return { getContext() { return {}; } };
      if (selector === '[data-project-grid]') return grid;
      return null;
    } },
    window: { location, matchMedia: () => ({ matches: true }), history: {
      pushState(_state, _title, url) { context.window.location = new URL(url, context.window.location); }
    } },
    data
  });
  vm.runInContext(fs.readFileSync('script.js', 'utf8').replace(/initialize\(\);\s*$/, ''), context);
  vm.runInContext(`
    projects = Object.fromEntries(data.map(normalizeProject).map((p, i) => [p.id, {...p, number: i + 1}]));
    projectCards = data.map(p => ({ dataset: { projectCard: p.id }, querySelector() { return {}; } }));
    applySkillFilter = function(skill) { selectedSkill = skill; };
  `, context);
  return { context, grid, run: code => vm.runInContext(code, context) };
}

test('every project has valid categories and IBM keeps empty URL placeholders', () => {
  assert.equal(new Set(data.map(p => p.id)).size, data.length);
  for (const p of data) {
    assert.ok(p.categories.length);
    assert.ok(p.categories.every(c => ['software', 'ai', 'blockchain', 'research'].includes(c)));
  }
  const ibm = data.find(p => p.id === 'ibm-mas-cli');
  assert.deepEqual(ibm.links.map(l => l.url), ['', '']);
});

test('category and stack intersect, including empty results and category-scoped counts', () => {
  const { run } = setup();
  for (const category of ['all', 'software', 'ai', 'blockchain', 'research']) {
    for (const skill of ['All', 'Python', 'Solidity', 'IBM MAS']) {
      run(`selectedCategory = ${JSON.stringify(category)}`);
      const actual = run(`getCardsMatchingSkill(${JSON.stringify(skill)}).map(c => c.dataset.projectCard)`);
      const expected = data.filter(p => (category === 'all' || p.categories.includes(category)) && (skill === 'All' || p.stack.includes(skill))).map(p => p.id);
      assert.deepEqual(Array.from(actual), expected);
    }
    assert.equal(run('getOverlapCount("All", [])'), data.filter(p => category === 'all' || p.categories.includes(category)).length);
  }
});

test('URL selection ranks IBM first, preserves stack and unrelated parameters, and restores All order', () => {
  const { run, context, grid } = setup();
  run('selectedSkill = "Python"; syncCategoryFromUrl()');
  assert.equal(run('selectedCategory'), 'software');
  assert.equal(run('selectedSkill'), 'Python');
  assert.equal(grid.cards[0].dataset.projectCard, 'ibm-mas-cli');
  run('selectCategory("ai")');
  assert.equal(context.window.location.search, '?category=ai&ref=cv');
  run('selectCategory("all")');
  assert.equal(context.window.location.search, '?ref=cv');
  assert.deepEqual(Array.from(grid.cards, c => c.dataset.projectCard), data.map(p => p.id));
  context.window.location = new URL('https://example.com/?category=unknown');
  run('syncCategoryFromUrl()');
  assert.equal(run('selectedCategory'), 'all');
});

test('project navigation retains category query', () => {
  const { run, context } = setup();
  run('renderProjectModal = function() {}; openProject("ibm-mas-cli")');
  assert.match(context.window.location.pathname, /^\/proj\/\d+$/);
  assert.equal(context.window.location.search, '?category=software&ref=cv');
});
