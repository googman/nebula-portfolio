import { useEffect, useMemo, useRef, useState } from "react";
import { createWork, deleteWorkById, getWorks, updateWork } from "./services/worksService.js";

function sortWorks(works) {
  return [...works].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function toDraft(work) {
  return {
    title: work?.title ?? "",
    date: work?.date ?? emptyDraft.date,
    category: work?.category ?? "前端开发",
    description: work?.description ?? "",
    tags: Array.isArray(work?.tags) ? work.tags.join(", ") : "",
    imageUrl: work?.imageUrl ?? "",
    link: work?.link ?? "",
  };
}

function normalizeDraft(draft, existing) {
  const now = new Date().toISOString();
  const date = draft.date || emptyDraft.date;
  return {
    id: existing?.id ?? `work-${Date.now()}`,
    title: draft.title.trim() || "未命名作品",
    date,
    year: Number(date.slice(0, 4)),
    category: draft.category.trim() || "未分类",
    description: draft.description.trim() || "这里还没有简介，稍后可以继续补充。",
    tags: draft.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    imageUrl: draft.imageUrl.trim(),
    link: draft.link.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function buildLayout(works) {
  const sorted = sortWorks(works);
  const yearGroups = new Map();
  sorted.forEach((work) => {
    const year = work.year || Number(work.date.slice(0, 4));
    yearGroups.set(year, [...(yearGroups.get(year) ?? []), work.id]);
  });

  const years = [...yearGroups.keys()].sort((a, b) => a - b);
  const yearStep = 460;
  const baseLeft = 170;
  const canvasWidth = Math.max(1320, baseLeft * 2 + Math.max(1, years.length - 1) * yearStep + 460);
  const lanes = [-92, 48, -22, 112, -142, 78];
  const yearIndex = new Map(years.map((year, index) => [year, index]));
  const byId = new Map();

  sorted.forEach((work) => {
    const year = work.year || Number(work.date.slice(0, 4));
    const group = yearGroups.get(year) ?? [];
    const localIndex = group.indexOf(work.id);
    const monthProgress = Math.max(0, Math.min(1, (new Date(work.date).getMonth() + 1) / 12));
    const x = baseLeft + (yearIndex.get(year) ?? 0) * yearStep + monthProgress * 250 + localIndex * 52;
    const lane = lanes[(localIndex + year) % lanes.length];
    const y = 310 + lane;
    byId.set(work.id, { x, y, year, visible: true });
  });

  return { sorted, years, byId, canvasWidth };
}

function App() {
  const [works, setWorks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const railRef = useRef(null);
  const dragState = useRef(null);

  useEffect(() => {
    let isMounted = true;
    getWorks().then((loadedWorks) => {
      if (!isMounted) return;
      const sorted = sortWorks(loadedWorks);
      setWorks(sorted);
      setSelectedId((current) => current ?? sorted.at(-1)?.id ?? null);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const categories = useMemo(() => ["全部", ...new Set(works.map((work) => work.category))], [works]);
  const layout = useMemo(() => buildLayout(works), [works]);
  const selectedWork = works.find((work) => work.id === selectedId) ?? layout.sorted.at(-1);

  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setTimeout(() => scrollToWork(selectedId, false), 80);
    return () => window.clearTimeout(timer);
  }, [layout.canvasWidth]);

  const filteredIds = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return new Set(
      works
        .filter((work) => category === "全部" || work.category === category)
        .filter((work) => {
          if (!lowerQuery) return true;
          return [work.title, work.description, work.category, ...work.tags].join(" ").toLowerCase().includes(lowerQuery);
        })
        .map((work) => work.id),
    );
  }, [category, query, works]);

  function scrollToWork(id, smooth = true) {
    const node = layout.byId.get(id);
    if (!node || !railRef.current) return;
    railRef.current.scrollTo({
      left: Math.max(0, node.x - railRef.current.clientWidth * 0.48),
      behavior: smooth ? "smooth" : "auto",
    });
  }

  function selectWork(id) {
    setSelectedId(id);
    scrollToWork(id);
  }

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft);
    setIsPanelOpen(true);
  }

  function openEdit(work) {
    setEditingId(work.id);
    setDraft(toDraft(work));
    setIsPanelOpen(true);
  }

  async function saveDraft(event) {
    event.preventDefault();
    const existing = works.find((work) => work.id === editingId);
    const savedWork = normalizeDraft(draft, existing);
    const persistedWork = existing
      ? await updateWork(existing.id, savedWork)
      : await createWork(savedWork);
    setWorks((current) => {
      const hasExisting = current.some((work) => work.id === persistedWork.id);
      const next = hasExisting
        ? current.map((work) => (work.id === persistedWork.id ? persistedWork : work))
        : [...current, persistedWork];
      return sortWorks(next);
    });
    setSelectedId(persistedWork.id);
    setIsPanelOpen(false);
    window.setTimeout(() => scrollToWork(persistedWork.id), 80);
  }

  async function deleteWork(id) {
    const target = works.find((work) => work.id === id);
    if (!target || !window.confirm(`确定删除「${target.title}」吗？`)) return;
    await deleteWorkById(id);
    const next = works.filter((work) => work.id !== id);
    setWorks(next);
    setSelectedId(sortWorks(next).at(-1)?.id);
  }

  function jumpToYear(year) {
    const work = layout.sorted.find((item) => item.year === year);
    if (work) selectWork(work.id);
  }

  function handleWheel(event) {
    if (!railRef.current || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();
    railRef.current.scrollLeft += event.deltaY;
  }

  function handlePointerDown(event) {
    if (!railRef.current || event.target.closest("button, a, input, textarea, select")) return;
    dragState.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      scrollLeft: railRef.current.scrollLeft,
    };
    railRef.current.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!dragState.current || !railRef.current) return;
    const delta = event.clientX - dragState.current.x;
    railRef.current.scrollLeft = dragState.current.scrollLeft - delta;
  }

  function handlePointerUp() {
    dragState.current = null;
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="作品库控制栏">
        <div>
          <p className="eyebrow">莫怀含舰牛</p>
          <h1>银河作品时间轴</h1>
        </div>
        <div className="topbar__center">0471</div>
        <div className="actions">
          <label className="search">
            <span>搜索</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="作品 / 标签 / 分类" />
          </label>
          <button className="primary" onClick={openCreate}>添加作品</button>
        </div>
      </section>

      <section className="filters" aria-label="分类筛选">
        {categories.map((item) => (
          <button
            key={item}
            className={category === item ? "active" : ""}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </section>

      <section
        className="galaxy-viewport"
        ref={railRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="银河时间轴，可横向拖拽浏览"
      >
        <div className="galaxy-canvas" style={{ width: `${layout.canvasWidth}px` }}>
          <div className="grid-lines" />
          <div className="nebula-band" />
          <svg className="constellation" width={layout.canvasWidth} height="620" aria-hidden="true">
            <defs>
              <linearGradient id="lineGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#19c7df" stopOpacity="0.18" />
                <stop offset="45%" stopColor="#dffaff" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#ff9b4c" stopOpacity="0.32" />
              </linearGradient>
            </defs>
            {layout.sorted.slice(1).map((work, index) => {
              const previous = layout.sorted[index];
              const start = layout.byId.get(previous.id);
              const end = layout.byId.get(work.id);
              if (!start || !end) return null;
              return (
                <line
                  key={`${previous.id}-${work.id}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  className={selectedId === work.id || selectedId === previous.id ? "line active" : "line"}
                />
              );
            })}
          </svg>

          {layout.years.map((year) => {
            const first = layout.sorted.find((work) => work.year === year);
            const position = first ? layout.byId.get(first.id) : null;
            return (
              <button
                key={year}
                className="year-marker"
                style={{ left: `${position?.x ?? 0}px` }}
                onClick={() => jumpToYear(year)}
              >
                {year}
              </button>
            );
          })}

          {layout.sorted.map((work, index) => {
            const point = layout.byId.get(work.id);
            const isSelected = selectedWork?.id === work.id;
            const isDimmed = !filteredIds.has(work.id);
            return (
              <button
                key={work.id}
                className={`star-node ${isSelected ? "selected" : ""} ${isDimmed ? "dimmed" : ""}`}
                style={{ left: `${point.x}px`, top: `${point.y}px`, "--delay": `${index * 0.17}s` }}
                onClick={() => selectWork(work.id)}
                aria-label={`查看作品 ${work.title}`}
              >
                <span className="star-node__core" />
                <span className="star-node__label">
                  <strong>{work.title}</strong>
                  <small>{work.year} · {work.category}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="detail-panel" aria-label="作品详情">
        {selectedWork ? (
          <>
            <div className="detail-panel__image">
              {selectedWork.imageUrl ? <img src={selectedWork.imageUrl} alt={selectedWork.title} /> : <div className="image-fallback">作品封面</div>}
            </div>
            <div className="detail-panel__body">
              <p className="eyebrow">{selectedWork.year} / {selectedWork.category}</p>
              <h2>{selectedWork.title}</h2>
              <p>{selectedWork.description}</p>
              <div className="tag-list">
                {selectedWork.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <div className="detail-actions">
                {selectedWork.link ? <a href={selectedWork.link} target="_blank" rel="noreferrer">打开作品</a> : <span>未设置链接</span>}
                <button onClick={() => openEdit(selectedWork)}>编辑</button>
                <button className="danger" onClick={() => deleteWork(selectedWork.id)}>删除</button>
              </div>
            </div>
          </>
        ) : (
          <p>还没有作品，先添加一个新的星体节点。</p>
        )}
      </aside>

      <section className="mini-timeline" aria-label="年份快速跳转">
        <span>远点</span>
        <div>
          {layout.years.map((year) => (
            <button key={year} onClick={() => jumpToYear(year)} className={selectedWork?.year === year ? "active" : ""}>
              {year}
            </button>
          ))}
        </div>
        <span>小结</span>
      </section>

      {isPanelOpen && (
        <section className="editor-backdrop" role="dialog" aria-modal="true" aria-label={editingId ? "编辑作品" : "添加作品"}>
          <form className="editor" onSubmit={saveDraft}>
            <div className="editor__header">
              <div>
                <p className="eyebrow">{editingId ? "Edit node" : "New node"}</p>
                <h2>{editingId ? "编辑作品星体" : "插入新的作品星体"}</h2>
              </div>
              <button type="button" className="ghost" onClick={() => setIsPanelOpen(false)}>关闭</button>
            </div>
            <label>
              标题
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
            </label>
            <div className="field-row">
              <label>
                日期
                <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required />
              </label>
              <label>
                分类
                <input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} required />
              </label>
            </div>
            <label>
              简介
              <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows="4" />
            </label>
            <label>
              标签，用英文逗号分隔
              <input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="React, Portfolio, Visual" />
            </label>
            <label>
              封面图 URL
              <input value={draft.imageUrl} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} />
            </label>
            <label>
              作品链接
              <input value={draft.link} onChange={(event) => setDraft({ ...draft, link: event.target.value })} />
            </label>
            <button className="primary" type="submit">{editingId ? "保存修改" : "添加到银河"}</button>
          </form>
        </section>
      )}
    </main>
  );
}

export { App };
