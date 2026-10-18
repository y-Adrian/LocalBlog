type ProjectStats = { stargazers_count: number; forks_count: number }

const projectStatsCache = new Map<string, Promise<ProjectStats>>()

document.addEventListener("nav", () => {
  const badges = document.querySelectorAll<HTMLAnchorElement>("[data-project-repository]")
  for (const badge of badges) {
    const repository = badge.dataset.projectRepository!
    const count = badge.querySelector<HTMLElement>("[data-project-metric]")
    if (!count) continue

    let request = projectStatsCache.get(repository)
    if (!request) {
      const path = repository.split("/").map(encodeURIComponent).join("/")
      request = fetch(`https://api.github.com/repos/${path}`)
        .then(async (response) => {
          if (!response.ok) throw new Error(`GitHub status ${response.status}`)
          const stats = await response.json()
          if (!Number.isInteger(stats.stargazers_count) || !Number.isInteger(stats.forks_count)) {
            throw new Error("Invalid GitHub counts")
          }
          return stats as ProjectStats
        })
        .catch((error) => {
          projectStatsCache.delete(repository)
          throw error
        })
      projectStatsCache.set(repository, request)
    }

    void request.then(
      (stats) => {
        const value =
          count.dataset.projectMetric === "stars" ? stats.stargazers_count : stats.forks_count
        count.textContent = new Intl.NumberFormat("en", { notation: "compact" }).format(value)
        count.setAttribute("aria-label", String(value))
        count.title = value.toLocaleString("en")
      },
      () => {
        count.textContent = "—"
        count.setAttribute("aria-label", "Count unavailable")
        count.title = "GitHub count temporarily unavailable"
      },
    )
  }
})
