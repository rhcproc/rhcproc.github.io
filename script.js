const canvas = document.querySelector(".starfield");
const context = canvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const projectModal = document.querySelector("#project-modal");
const modalTags = document.querySelector("#modal-tags");
const modalTitle = document.querySelector("#modal-title");
const modalSummary = document.querySelector("#modal-summary");
const modalImage = document.querySelector("#modal-image");
const modalDetails = document.querySelector("#modal-details");
const modalStory = document.querySelector("#modal-story");
const modalOutcomes = document.querySelector("#modal-outcomes");
const modalCaseStudy = document.querySelector("#modal-case-study");
const modalSource = document.querySelector("#modal-source");
const modalPrev = document.querySelector("[data-project-prev]");
const modalNext = document.querySelector("[data-project-next]");
const skillFilters = document.querySelector("[data-skill-filters]");
const skillSearch = document.querySelector("[data-skill-search]");
const projectGrid = document.querySelector("[data-project-grid]");

let stars = [];
let width = 0;
let height = 0;
let animationFrame = null;
let currentProjectKey = null;
let orderedProjectImages = [];
let orderedProjectImagesReady = Promise.resolve();
let projectCards = [];
let projectOrder = [];
let projects = {};

async function loadProjects() {
  if (window.location.protocol === "file:") {
    return [];
  }

  try {
    const response = await fetch("assets/projects/projects.json", { cache: "no-store" });

    if (!response.ok) {
      return [];
    }

    const projectList = await response.json();
    return Array.isArray(projectList) ? projectList : [];
  } catch {
    return [];
  }
}

function normalizeProject(project, index) {
  const id = project.id || `project-${index + 1}`;
  const stack = Array.isArray(project.stack) ? project.stack : String(project.stack || "").split(",");

  return {
    id,
    category: project.category || "Project",
    title: project.title || "Untitled Project",
    summary: project.summary || "",
    role: project.role || "",
    stack: stack.map((item) => item.trim()).filter(Boolean),
    result: project.result || "",
    story: project.story || "",
    outcomes: Array.isArray(project.outcomes) ? project.outcomes : [],
    caseStudy: project.caseStudy || "#",
    source: project.source || "#"
  };
}

function renderProjectCards(projectList) {
  const normalizedProjects = projectList.map(normalizeProject);
  projects = Object.fromEntries(normalizedProjects.map((project) => [project.id, project]));
  projectOrder = normalizedProjects.map((project) => project.id);

  projectGrid.replaceChildren(...normalizedProjects.map((project) => {
    const article = document.createElement("article");
    article.className = "project-card";
    article.dataset.projectCard = project.id;

    article.innerHTML = `
      <div class="project-meta">
        <span></span>
        <span></span>
      </div>
      <h3></h3>
      <p></p>
      <dl class="project-details">
        <div>
          <dt>Role</dt>
          <dd></dd>
        </div>
        <div>
          <dt>Stack</dt>
          <dd></dd>
        </div>
      </dl>
      <div class="project-links">
        <button type="button" data-open-project="">More detail</button>
        <a href="#">Source</a>
      </div>
    `;

    const meta = article.querySelectorAll(".project-meta span");
    meta[1].textContent = project.category;
    article.querySelector("h3").textContent = project.title;
    article.querySelector("p").textContent = project.summary;
    article.querySelector(".project-details div:nth-child(1) dd").textContent = project.role;
    article.querySelector(".project-details div:nth-child(2) dd").textContent = project.stack.join(", ");
    article.querySelector("[data-open-project]").dataset.openProject = project.id;
    article.querySelector(".project-links a").href = project.source;

    return article;
  }));

  projectCards = Array.from(document.querySelectorAll("[data-project-card]"));
}

function getProjectNumber(projectKey) {
  const projectIndex = projectOrder.indexOf(projectKey);
  return projectIndex === -1 ? "" : `Project ${String(projectIndex + 1).padStart(2, "0")}`;
}

function applyProjectImage(projectKey) {
  const project = projects[projectKey];
  const projectIndex = projectOrder.indexOf(projectKey);

  if (projectIndex === -1) {
    modalImage.src = "assets/stellar-hero.png";
    modalImage.alt = `${project.title} project preview.`;
    return;
  }

  const orderedImage = orderedProjectImages[projectIndex];

  if (orderedImage) {
    modalImage.onerror = () => {
      modalImage.onerror = null;
      modalImage.src = "assets/stellar-hero.png";
    };
    modalImage.alt = `${project.title} project preview.`;
    modalImage.src = orderedImage.url;
    return;
  }

  modalImage.onerror = null;
  modalImage.alt = `${project.title} project preview.`;
  modalImage.src = "assets/stellar-hero.png";
}

function getGitHubContentsUrl() {
  const hostParts = window.location.hostname.split(".");
  const isGitHubPages = window.location.hostname.endsWith(".github.io");

  if (!isGitHubPages || hostParts.length < 3) {
    return null;
  }

  const owner = hostParts[0];
  const firstPathSegment = window.location.pathname.split("/").filter(Boolean)[0];
  const repo = firstPathSegment || `${owner}.github.io`;
  return `https://api.github.com/repos/${owner}/${repo}/contents/assets/projects`;
}

async function loadOrderedProjectImages() {
  const manifestImages = await loadProjectImageManifest();

  if (manifestImages.length > 0) {
    orderedProjectImages = manifestImages;
    return;
  }

  const contentsUrl = getGitHubContentsUrl();

  if (!contentsUrl) {
    return;
  }

  try {
    const response = await fetch(contentsUrl, { headers: { Accept: "application/vnd.github+json" } });

    if (!response.ok) {
      return;
    }

    const files = await response.json();
    orderedProjectImages = files
      .filter((file) => file.type === "file" && /\.(png|jpe?g|webp)$/i.test(file.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
      .map((file) => ({
        name: file.name,
        url: file.download_url
      }));
  } catch {
    orderedProjectImages = [];
  }
}

async function loadProjectImageManifest() {
  if (window.location.protocol === "file:") {
    return [];
  }

  try {
    const response = await fetch("assets/projects/images.json", { cache: "no-store" });

    if (!response.ok) {
      return [];
    }

    const filenames = await response.json();

    if (!Array.isArray(filenames)) {
      return [];
    }

    return filenames
      .filter((filename) => typeof filename === "string" && /\.(png|jpe?g|webp)$/i.test(filename))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
      .map((filename) => ({
        name: filename,
        url: `assets/projects/${filename}`
      }));
  } catch {
    return [];
  }
}

function getProjectTags(projectKey) {
  const project = projects[projectKey];
  return [getProjectNumber(projectKey), project.category].filter(Boolean);
}

function renderProjectNumbers() {
  projectCards.forEach((card) => {
    const numberTarget = card.querySelector(".project-meta span:first-child");
    const projectNumber = getProjectNumber(card.dataset.projectCard);

    if (numberTarget && projectNumber) {
      numberTarget.textContent = projectNumber;
    }
  });
}

function getCardStackKeywords(card) {
  const project = projects[card.dataset.projectCard];
  return project?.stack || [];
}

function renderSkillFilters() {
  if (!skillFilters) {
    return;
  }

  const keywords = [...new Set(projectCards.flatMap(getCardStackKeywords))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const filters = ["All", ...keywords];

  skillFilters.replaceChildren(...filters.map((keyword) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = keyword;
    button.dataset.skillFilter = keyword;
    button.setAttribute("aria-pressed", keyword === "All" ? "true" : "false");
    item.append(button);
    return item;
  }));
}

function applySkillFilter(selectedSkill) {
  const showAll = selectedSkill === "All";

  projectCards.forEach((card) => {
    const stackKeywords = getCardStackKeywords(card);
    const isMatch = showAll || stackKeywords.includes(selectedSkill);
    card.classList.toggle("is-hidden", !isMatch);
  });

  skillFilters?.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.skillFilter === selectedSkill ? "true" : "false");
  });
}

function filterSkillButtons(query) {
  const normalizedQuery = query.trim().toLowerCase();

  skillFilters?.querySelectorAll("li").forEach((item) => {
    const button = item.querySelector("[data-skill-filter]");
    const skill = button?.dataset.skillFilter.toLowerCase() || "";
    item.classList.toggle("is-hidden", normalizedQuery !== "" && !skill.includes(normalizedQuery));
  });
}

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const starCount = Math.min(180, Math.floor((width * height) / 7800));
  stars = Array.from({ length: starCount }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 1.4 + 0.25,
    speed: Math.random() * 0.16 + 0.035,
    alpha: Math.random() * 0.55 + 0.25
  }));
}

function drawStars() {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#030406";
  context.fillRect(0, 0, width, height);

  for (const star of stars) {
    context.beginPath();
    context.globalAlpha = star.alpha;
    context.fillStyle = "#f7f3ea";
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();

    if (!prefersReducedMotion) {
      star.y += star.speed;
      if (star.y > height + 4) {
        star.y = -4;
        star.x = Math.random() * width;
      }
    }
  }

  context.globalAlpha = 1;

  if (!prefersReducedMotion) {
    animationFrame = requestAnimationFrame(drawStars);
  }
}

function startStarfield() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }

  resizeCanvas();
  drawStars();
}

async function renderProjectModal(projectKey) {
  const project = projects[projectKey];

  if (!project || !projectModal) {
    return;
  }

  await orderedProjectImagesReady;

  currentProjectKey = projectKey;

  modalTags.replaceChildren(...getProjectTags(projectKey).map((tag) => {
    const item = document.createElement("span");
    item.textContent = tag;
    return item;
  }));

  modalTitle.textContent = project.title;
  modalSummary.textContent = project.summary;
  applyProjectImage(projectKey);
  modalStory.textContent = project.story;
  modalCaseStudy.href = project.caseStudy;
  modalSource.href = project.source;

  const details = {
    Role: project.role,
    Stack: project.stack.join(", "),
    Result: project.result
  };

  modalDetails.replaceChildren(...Object.entries(details).map(([label, value]) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    return row;
  }));

  modalOutcomes.replaceChildren(...project.outcomes.map((outcome) => {
    const item = document.createElement("li");
    item.textContent = outcome;
    return item;
  }));

  updateModalNavigation();
  projectModal.showModal();
}

function getAdjacentProject(direction) {
  const currentIndex = projectOrder.indexOf(currentProjectKey);

  if (currentIndex === -1 || projectOrder.length < 2) {
    return null;
  }

  const nextIndex = (currentIndex + direction + projectOrder.length) % projectOrder.length;
  return projectOrder[nextIndex];
}

function updateModalNavigation() {
  const hasMultipleProjects = projectOrder.length > 1;
  const previousProject = getAdjacentProject(-1);
  const nextProject = getAdjacentProject(1);

  modalPrev.disabled = !hasMultipleProjects;
  modalNext.disabled = !hasMultipleProjects;

  if (previousProject) {
    modalPrev.setAttribute("aria-label", `Previous project: ${projects[previousProject].title}`);
  }

  if (nextProject) {
    modalNext.setAttribute("aria-label", `Next project: ${projects[nextProject].title}`);
  }
}

function navigateProject(direction) {
  const projectKey = getAdjacentProject(direction);

  if (projectKey) {
    renderProjectModal(projectKey);
  }
}

function bindEvents() {
  projectGrid?.addEventListener("click", (event) => {
    const sourceLink = event.target.closest("a");
    const detailButton = event.target.closest("[data-open-project]");
    const card = event.target.closest("[data-project-card]");

    if (detailButton) {
      renderProjectModal(detailButton.dataset.openProject);
      return;
    }

    if (sourceLink || !card) {
      return;
    }

    renderProjectModal(card.dataset.projectCard);
  });

  skillFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-skill-filter]");

    if (button) {
      applySkillFilter(button.dataset.skillFilter);
    }
  });

  skillSearch?.addEventListener("input", () => {
    filterSkillButtons(skillSearch.value);
  });

  document.querySelector("[data-close-modal]")?.addEventListener("click", () => {
    projectModal.close();
  });

  modalPrev?.addEventListener("click", () => navigateProject(-1));
  modalNext?.addEventListener("click", () => navigateProject(1));

  projectModal?.addEventListener("click", (event) => {
    if (event.target === projectModal) {
      projectModal.close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!projectModal?.open) {
      return;
    }

    if (event.key === "ArrowLeft") {
      navigateProject(-1);
    }

    if (event.key === "ArrowRight") {
      navigateProject(1);
    }
  });
}

async function initialize() {
  window.addEventListener("resize", startStarfield, { passive: true });
  startStarfield();
  bindEvents();

  const projectList = await loadProjects();
  renderProjectCards(projectList);
  renderProjectNumbers();
  renderSkillFilters();
  orderedProjectImagesReady = loadOrderedProjectImages();
}

initialize();
