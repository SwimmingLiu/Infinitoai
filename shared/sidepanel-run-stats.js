(function(root, factory) {
  const exports = factory(
    root.AutoRunFailureStats
  );

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }

  root.SidepanelRunStats = exports;
})(typeof globalThis !== 'undefined' ? globalThis : self, function(AutoRunFailureStats) {
  const {
    normalizeAutoRunStats,
    summarizeAutoRunFailureBuckets,
  } = AutoRunFailureStats || require('./auto-run-failure-stats.js');

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatRunStatsAverageDuration(stats = {}) {
    const normalizedStats = normalizeAutoRunStats(stats);
    if (normalizedStats.successfulRuns <= 0 || normalizedStats.totalSuccessfulDurationMs <= 0) {
      return '--';
    }

    const averageMs = Math.round(normalizedStats.totalSuccessfulDurationMs / normalizedStats.successfulRuns);
    const totalSeconds = Math.max(0, Math.round(averageMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value) => String(value).padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  function buildRunStatsSummaryHtml(stats = {}) {
    const normalizedStats = normalizeAutoRunStats(stats);
    return `
      <span class="run-stat-text success">成功 ${normalizedStats.successfulRuns} · 均时 ${escapeHtml(formatRunStatsAverageDuration(normalizedStats))}</span>
      <span class="run-stat-text failure">错误 ${normalizedStats.failedRuns}</span>
    `;
  }

  function buildRunSuccessSummaryHtml(stats = {}) {
    const normalizedStats = normalizeAutoRunStats(stats);
    return `<span class="run-stat-text success">成功 ${normalizedStats.successfulRuns} · 均时 ${escapeHtml(formatRunStatsAverageDuration(normalizedStats))}</span>`;
  }

  function buildRunFailureSummaryHtml(stats = {}) {
    const normalizedStats = normalizeAutoRunStats(stats);
    return `<span class="run-stat-text failure">错误 ${normalizedStats.failedRuns}</span>`;
  }

  function formatSuccessModeLabel(mode) {
    if (mode === 'api') {
      return 'API';
    }
    if (mode === 'simulated') {
      return '模拟操作';
    }
    return '';
  }

  function getRecentSuccessDisplayEntries(stats = {}) {
    const normalizedStats = normalizeAutoRunStats(stats);
    return normalizedStats.recentSuccessDurationsMs.map((durationMs, index) => ({
      durationMs,
      mode: normalizedStats.recentSuccessEntries[index]?.mode || 'unknown',
    }));
  }

  function buildRunSuccessDetailsHtml(stats = {}) {
    const successEntries = getRecentSuccessDisplayEntries(stats);
    if (!successEntries.length) {
      return '<div class="run-success-empty">暂无成功记录</div>';
    }

    return `
      <div class="run-success-list-label">最近 20 次成功耗时</div>
      <div class="run-success-list">
        ${successEntries.map((entry, index) => `
          <div class="run-success-item">
            <span class="run-success-rank">#${index + 1}</span>
            <div class="run-success-meta">
              ${formatSuccessModeLabel(entry.mode)
                ? `<span class="run-success-source run-success-source-${escapeHtml(entry.mode)}">${escapeHtml(formatSuccessModeLabel(entry.mode))}</span>`
                : ''}
              <span class="run-success-duration">${escapeHtml(formatRunStatsAverageDuration({
              successfulRuns: 1,
              totalSuccessfulDurationMs: entry.durationMs,
            }))}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function buildRunStatsDetailsHtml(stats = {}) {
    const buckets = summarizeAutoRunFailureBuckets(stats);
    if (!buckets.length) {
      return '<div class="run-failure-empty">暂无失败记录</div>';
    }

    return buckets.map((bucket) => {
      const stepLabel = bucket.step > 0 ? `Step ${bucket.step}` : '流程级';
      const recentLogsHtml = bucket.recentLogs.length
        ? `
          <div class="run-failure-logs-label">最近日志</div>
          <div class="run-failure-logs">
            ${bucket.recentLogs.map((entry) => `<div class="run-failure-log">${escapeHtml(entry)}</div>`).join('')}
          </div>
        `
        : '';

      return `
        <details class="run-failure-card">
          <summary class="run-failure-summary">
            <div class="run-failure-head">
              <span class="run-failure-step">${escapeHtml(stepLabel)}</span>
              <span class="run-failure-count">${bucket.count} 次</span>
            </div>
            <div class="run-failure-reason">${escapeHtml(bucket.reason)}</div>
            <div class="run-failure-meta">最近发生：${escapeHtml(bucket.lastRunLabel || '未知轮次')}</div>
          </summary>
          <div class="run-failure-body">
            ${recentLogsHtml}
          </div>
        </details>
      `;
    }).join('');
  }

  function normalizeDisplayedAutoRunStats(stats = {}) {
    return normalizeAutoRunStats(stats);
  }

  return {
    buildRunFailureSummaryHtml,
    buildRunSuccessDetailsHtml,
    buildRunSuccessSummaryHtml,
    buildRunStatsSummaryHtml,
    buildRunStatsDetailsHtml,
    formatRunStatsAverageDuration,
    normalizeDisplayedAutoRunStats,
  };
});
