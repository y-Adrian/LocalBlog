import path from "node:path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import {
  buildContributionColumns,
  groupActivityByMonth,
  loadBlogActivityForDisplay,
} from "../util/blogActivity"
import style from "./styles/contributions.scss"

/** 首页：展示博客 Markdown 增删改（优先读 blog-activity.cache.json，构建时无需完整 Git 历史） */
const Contributions: QuartzComponent = (props: QuartzComponentProps) => {
  const contentRoot = path.resolve(props.ctx.argv.directory)
  const end = new Date()
  const { counts, activity, windowStart, ok } = loadBlogActivityForDisplay(contentRoot)
  const { columns, monthLabels } = buildContributionColumns(counts, end, windowStart)
  const activityGroups = groupActivityByMonth(activity)

  const rowLabelFor = (rowIndex: number) => {
    if (rowIndex === 1) return "一"
    if (rowIndex === 3) return "三"
    if (rowIndex === 5) return "五"
    return ""
  }

  return (
    <section class="contrib-section">
      <div class="contrib-header">
        <h2 class="contrib-title">内容更新</h2>
      </div>

      {!ok ? (
        <p class="contrib-empty">
          未找到 <code>blog-activity.cache.json</code>，且当前环境无法读取 Git。请在仓库根执行{" "}
          <code>npm run activity:update</code> 生成缓存并提交后重新构建。
        </p>
      ) : (
        <>
          <div class="contrib-wrap">
            <div class="contrib-matrix">
              <div class="contrib-gutter">
                <div class="contrib-gutter-spacer" aria-hidden="true" />
                <div class="contrib-rows-label" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <span key={i}>{rowLabelFor(i)}</span>
                  ))}
                </div>
              </div>
              {columns.map((col, wi) => (
                <div class="contrib-col" key={wi}>
                  <div class="contrib-month-cap" aria-hidden="true">
                    {monthLabels[wi] ? monthLabels[wi] : "\u00a0"}
                  </div>
                  <div class="contrib-week">
                    {col.map((cell, ri) => (
                      <span
                        class="contrib-cell"
                        data-level={cell.future ? 0 : cell.level}
                        title={
                          cell.future
                            ? `${cell.key}（未到）`
                            : cell.beforeWindow
                              ? `${cell.key}`
                              : `${cell.key} · ${cell.count} 处笔记变动`
                        }
                        key={ri}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div class="contrib-legend" aria-hidden="true">
            <span>少</span>
            <div class="contrib-legend-cells">
              {[0, 1, 2, 3, 4].map((lv) => (
                <span class="contrib-cell" data-level={lv} key={lv} />
              ))}
            </div>
            <span>多</span>
          </div>

          {activityGroups.length > 0 ? (
            <div class="contrib-activity">
              <h3>文章动态</h3>
              {activityGroups.map((g) => (
                <div key={g.label}>
                  <div class="contrib-activity-month">{g.label}</div>
                  <ul>
                    {g.items.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

Contributions.css = style

export default (() => Contributions) satisfies QuartzComponentConstructor
