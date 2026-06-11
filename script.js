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

let stars = [];
let width = 0;
let height = 0;
let animationFrame = null;
let currentProjectKey = null;
let orderedProjectImages = [];

const projects = {
  cost: {
    tags: ["Featured", "Cloud + AI"],
    title: "Azure Cost Intelligence Console",
    summary: "A focused command center for discovering spend anomalies, unused resources, and rightsizing opportunities across cloud subscriptions.",
    details: {
      Role: "Full-stack engineering",
      Stack: "Azure, Python, KQL, TypeScript",
      Result: "Actionable cost reports and prioritized savings"
    },
    story: "The project brings cost, utilization, and ownership signals into one readable workflow. It is designed to help a team move from raw cloud spend to a short list of decisions that can actually be acted on.",
    outcomes: [
      "Highlights idle and underused resources by subscription.",
      "Ranks recommendations by estimated savings and effort.",
      "Produces a clear report for follow-up and governance."
    ],
    caseStudy: "#",
    source: "#"
  },
  agents: {
    tags: ["Project 02", "Agents"],
    title: "Foundry Agent Evaluation Lab",
    summary: "A repeatable evaluation workflow for hosted AI agents, including test datasets, scoring runs, and prompt iteration notes.",
    details: {
      Role: "AI systems engineer",
      Stack: "Azure AI Foundry, Docker, YAML",
      Result: "Repeatable agent quality checks before release"
    },
    story: "This lab treats agent behavior as something measurable. It keeps evaluation data, scoring configuration, and iteration notes close together so every prompt or tool change can be compared against earlier runs.",
    outcomes: [
      "Creates a repeatable loop for prompt and tool changes.",
      "Keeps datasets and scoring configuration easy to audit.",
      "Makes regression checks visible before deployment."
    ],
    caseStudy: "#",
    source: "#"
  },
  portfolio: {
    tags: ["Project 03", "Web"],
    title: "Operations Portfolio Site",
    summary: "A fast static GitHub Pages site with cinematic visuals, structured project cards, and direct paths to contact and source code.",
    details: {
      Role: "Frontend design and build",
      Stack: "HTML, CSS, JavaScript",
      Result: "A polished buildless portfolio for GitHub Pages"
    },
    story: "The site keeps the first screen atmospheric, then makes the work easy to scan through large cards. Each modal gives enough detail for a visitor to understand the problem, contribution, and result.",
    outcomes: [
      "Loads as plain static files on GitHub Pages.",
      "Uses modal detail views without adding a framework.",
      "Keeps project information structured and easy to update."
    ],
    caseStudy: "#",
    source: "#"
  },
  automation: {
    tags: ["Project 04", "Automation"],
    title: "Deployment Runbook System",
    summary: "A scripted deployment workflow that turns repeated manual steps into clear, auditable commands for shipping services with less drift.",
    details: {
      Role: "Platform automation",
      Stack: "Bash, GitHub Actions, Azure CLI",
      Result: "Fewer manual release steps and clearer rollback notes"
    },
    story: "This project packages release steps into commands and checks that can be run the same way every time. It focuses on reducing ambiguous handoffs and making deployment state visible.",
    outcomes: [
      "Documents required release inputs before deployment starts.",
      "Runs validation checks before changing live resources.",
      "Captures command output for easier review and rollback."
    ],
    caseStudy: "#",
    source: "#"
  }
};

const projectOrder = Array.from(document.querySelectorAll("[data-project-card]"))
  .map((card) => card.dataset.projectCard)
  .filter((projectKey) => projects[projectKey]);

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

function getProjectTags(projectKey) {
  const project = projects[projectKey];
  const categoryTags = project.tags.filter((tag) => !/^Project \d+$/i.test(tag) && tag !== "Featured");
  return [getProjectNumber(projectKey), ...categoryTags].filter(Boolean);
}

function renderProjectNumbers() {
  document.querySelectorAll("[data-project-card]").forEach((card) => {
    const numberTarget = card.querySelector(".project-meta span:first-child");
    const projectNumber = getProjectNumber(card.dataset.projectCard);

    if (numberTarget && projectNumber) {
      numberTarget.textContent = projectNumber;
    }
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

function start() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }

  resizeCanvas();
  drawStars();
}

window.addEventListener("resize", start, { passive: true });
start();
renderProjectNumbers();
const orderedProjectImagesReady = loadOrderedProjectImages();

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

  modalDetails.replaceChildren(...Object.entries(project.details).map(([label, value]) => {
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

document.querySelectorAll("[data-open-project]").forEach((button) => {
  button.addEventListener("click", () => renderProjectModal(button.dataset.openProject));
});

document.querySelectorAll("[data-project-card]").forEach((card) => {
  card.addEventListener("dblclick", () => renderProjectModal(card.dataset.projectCard));
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
