/**
 * PersonaSync — WeeklyReport Bileşeni
 * =====================================
 * AI Koç haftalık ilerleme raporu kartı.
 * coach.tsx ekranında kullanılır, bağımsız ve yeniden kullanılabilir.
 *
 * Props:
 *   report     — WeeklyReport verisi (backend'den gelen)
 *   onRefresh  — "Raporu yenile" butonuna basıldığında
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { PersonaSyncColors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import type { WeeklyReport, WeeklyStatsSnapshot } from '@/services/ai_coach_api';

// ─────────────────────────────────────────────
// Tipler
// ─────────────────────────────────────────────

interface WeeklyReportProps {
  report: WeeklyReport;
  onRefresh?: () => void;
}

// ─────────────────────────────────────────────
// Alt Bileşenler
// ─────────────────────────────────────────────

/** Sayısal özet kutusu */
function StatBox({ value, label, accent }: {
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <View style={[styles.statBox, accent && styles.statBoxAccent]}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, accent && styles.statLabelAccent]}>
        {label}
      </Text>
    </View>
  );
}

/** Güçlü yön / gelişim alanı satırı */
function InsightRow({ text, type }: {
  text: string;
  type: 'strength' | 'improvement';
}) {
  const isStrength = type === 'strength';
  return (
    <View style={[styles.insightRow, isStrength ? styles.insightRowStrength : styles.insightRowImprovement]}>
      <View style={[styles.insightIconBox, isStrength ? styles.insightIconBoxStrength : styles.insightIconBoxImprovement]}>
        <Text style={styles.insightIcon}>{isStrength ? '✓' : '→'}</Text>
      </View>
      <Text style={styles.insightText}>{text}</Text>
    </View>
  );
}

/** Günlük çubuk grafiği */
function DailyBarChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).slice(-7); // Son 7 gün
  if (entries.length === 0) return null;

  const maxMinutes = Math.max(...entries.map(([, v]) => v), 1);

  const dayLabels: Record<string, string> = {
    '0': 'Paz', '1': 'Pzt', '2': 'Sal', '3': 'Çar',
    '4': 'Per', '5': 'Cum', '6': 'Cmt',
  };

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Günlük Dağılım</Text>
      <View style={styles.chartBars}>
        {entries.map(([dateStr, minutes]) => {
          const heightPct = minutes / maxMinutes;
          const date = new Date(dateStr);
          const dayName = dayLabels[String(date.getDay())] ?? '–';
          const isToday = dateStr === new Date().toISOString().split('T')[0];

          return (
            <View key={dateStr} style={styles.chartBarWrapper}>
              <Text style={styles.chartBarValue}>
                {minutes > 0 ? `${minutes}` : ''}
              </Text>
              <View style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: `${Math.max(heightPct * 100, 4)}%`,
                      backgroundColor: isToday ? C.accent : C.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.chartBarLabel, isToday && styles.chartBarLabelToday]}>
                {dayName}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Kategori dağılım etiketi */
function CategoryTag({ category, count }: { category: string; count: number }) {
  const categoryNames: Record<string, { label: string; emoji: string }> = {
    lesson:   { label: 'Ders',    emoji: '📖' },
    project:  { label: 'Proje',   emoji: '💻' },
    reading:  { label: 'Okuma',   emoji: '📚' },
    homework: { label: 'Ödev',    emoji: '✏️'  },
    personal: { label: 'Kişisel', emoji: '🌱' },
    other:    { label: 'Diğer',   emoji: '📝' },
  };
  const meta = categoryNames[category] ?? { label: category, emoji: '📌' };

  return (
    <View style={styles.categoryTag}>
      <Text style={styles.categoryTagEmoji}>{meta.emoji}</Text>
      <Text style={styles.categoryTagLabel}>{meta.label}</Text>
      <View style={styles.categoryTagBadge}>
        <Text style={styles.categoryTagCount}>{count}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Ana Bileşen
// ─────────────────────────────────────────────

export function WeeklyReportCard({ report, onRefresh }: WeeklyReportProps) {
  const snap = report.stats_snapshot;

  // Bölümlerin kademeli giriş animasyonu
  const anims = useRef(
    Array.from({ length: 6 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(20),
    })),
  ).current;

  useEffect(() => {
    const animations = anims.map((a, i) =>
      Animated.parallel([
        Animated.timing(a.opacity, {
          toValue: 1,
          duration: 300,
          delay: i * 80,
          useNativeDriver: true,
        }),
        Animated.timing(a.translateY, {
          toValue: 0,
          duration: 300,
          delay: i * 80,
          useNativeDriver: true,
        }),
      ]),
    );
    Animated.stagger(80, animations).start();
  }, []);

  function animStyle(index: number) {
    return {
      opacity: anims[index].opacity,
      transform: [{ translateY: anims[index].translateY }],
    };
  }

  return (
    <View>

      {/* ════════════════════════════════════════
          BÖLÜM 1 — İSTATİSTİK ÖZETİ
      ════════════════════════════════════════ */}
      <Animated.View style={animStyle(0)}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            📋 {report.period_days} Günlük Özet
          </Text>
          <Text style={styles.summaryText}>{report.week_summary}</Text>

          {snap && (
            <>
              {/* Stat kutuları */}
              <View style={styles.statsGrid}>
                <StatBox
                  value={snap.completed_sessions}
                  label="Tamamlanan Seans"
                  accent
                />
                <StatBox
                  value={`${snap.total_minutes} dk`}
                  label="Toplam Çalışma"
                />
                <StatBox
                  value={`%${snap.completion_rate}`}
                  label="Başarı Oranı"
                  accent={snap.completion_rate >= 70}
                />
                <StatBox
                  value={`${snap.streak_days} gün`}
                  label="Aktif Seri"
                  accent={snap.streak_days >= 3}
                />
              </View>

              {/* Günlük bar chart */}
              {Object.keys(snap.daily_breakdown).length > 0 && (
                <DailyBarChart data={snap.daily_breakdown} />
              )}

              {/* Kategori dağılımı */}
              {Object.keys(snap.category_breakdown).length > 0 && (
                <View style={styles.categoriesSection}>
                  <Text style={styles.categoriesTitle}>Kategori Dağılımı</Text>
                  <View style={styles.categoriesRow}>
                    {Object.entries(snap.category_breakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, count]) => (
                        <CategoryTag key={cat} category={cat} count={count} />
                      ))}
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </Animated.View>

      {/* ════════════════════════════════════════
          BÖLÜM 2 — HAFTANIN BAŞARISI
      ════════════════════════════════════════ */}
      <Animated.View style={animStyle(1)}>
        <View style={styles.highlightCard}>
          <Text style={styles.highlightStarEmoji}>🌟</Text>
          <Text style={styles.highlightSectionLabel}>Haftanın Başarısı</Text>
          <Text style={styles.highlightText}>{report.highlight}</Text>
        </View>
      </Animated.View>

      {/* ════════════════════════════════════════
          BÖLÜM 3 — GÜÇLÜ YÖNLER
      ════════════════════════════════════════ */}
      <Animated.View style={animStyle(2)}>
        <View style={styles.insightsCard}>
          <View style={styles.insightsSectionHeader}>
            <View style={[styles.insightsSectionDot, styles.insightsDotStrength]} />
            <Text style={styles.insightsSectionTitle}>Güçlü Yönlerin</Text>
          </View>
          <Text style={styles.insightsSectionSub}>
            Bu hafta iyi gittiğin alanlar
          </Text>
          {report.strengths.map((s, i) => (
            <InsightRow key={i} text={s} type="strength" />
          ))}
        </View>
      </Animated.View>

      {/* ════════════════════════════════════════
          BÖLÜM 4 — GELİŞİM ALANLARI
      ════════════════════════════════════════ */}
      <Animated.View style={animStyle(3)}>
        <View style={styles.insightsCard}>
          <View style={styles.insightsSectionHeader}>
            <View style={[styles.insightsSectionDot, styles.insightsDotImprovement]} />
            <Text style={styles.insightsSectionTitle}>Gelişim Alanların</Text>
          </View>
          <Text style={styles.insightsSectionSub}>
            Gelecek hafta odaklanabileceğin fırsatlar
          </Text>
          {report.improvements.map((s, i) => (
            <InsightRow key={i} text={s} type="improvement" />
          ))}
        </View>
      </Animated.View>

      {/* ════════════════════════════════════════
          BÖLÜM 5 — GELECEK HAFTA
      ════════════════════════════════════════ */}
      <Animated.View style={animStyle(4)}>
        <View style={styles.nextWeekCard}>
          {/* Başlık */}
          <View style={styles.nextWeekHeader}>
            <Text style={styles.nextWeekEmoji}>🗓</Text>
            <Text style={styles.nextWeekTitle}>Gelecek Hafta Planı</Text>
          </View>

          {/* Odak Alanı */}
          <Text style={styles.nextWeekFocusLabel}>Öncelikli Hedef</Text>
          <Text style={styles.nextWeekFocusText}>{report.next_week_focus}</Text>

          {/* Teknik Önerisi */}
          <View style={styles.techniqueBox}>
            <View style={styles.techniqueLabelRow}>
              <Text style={styles.techniqueLabelEmoji}>⚡</Text>
              <Text style={styles.techniqueLabel}>Önerilen Teknik</Text>
            </View>
            <Text style={styles.techniqueName}>
              {report.technique_recommendation}
            </Text>
            <Text style={styles.techniqueReason}>{report.technique_reason}</Text>
          </View>
        </View>
      </Animated.View>

      {/* ════════════════════════════════════════
          BÖLÜM 6 — KAPANIŞ MESAJI
      ════════════════════════════════════════ */}
      <Animated.View style={animStyle(5)}>
        <View style={styles.closingCard}>
          <Text style={styles.closingQuoteMark}>"</Text>
          <Text style={styles.closingText}>{report.motivational_closing}</Text>
        </View>

        {/* Yenile Butonu */}
        {onRefresh && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshButtonText}>🔄 Raporu Yenile</Text>
          </TouchableOpacity>
        )}

        {/* Üretim zamanı */}
        <Text style={styles.generatedAt}>
          {new Date(report.generated_at).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })} tarihinde oluşturuldu
        </Text>
      </Animated.View>

    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const C = PersonaSyncColors;

const styles = StyleSheet.create({

  // ── Özet Kartı ───────────────────────────────
  summaryCard: {
    backgroundColor: C.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.primary,
    marginBottom: Spacing.sm,
  },
  summaryText: {
    fontSize: 14,
    color: C.charcoal,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },

  // İstatistik Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: C.offWhite,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  statBoxAccent: {
    backgroundColor: C.accent + '15',
    borderWidth: 1,
    borderColor: C.accent + '40',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: C.primary,
  },
  statValueAccent: {
    color: C.accent,
  },
  statLabel: {
    fontSize: 11,
    color: C.gray,
    marginTop: 3,
    textAlign: 'center',
  },
  statLabelAccent: {
    color: C.accentDark,
  },

  // Bar Chart
  chartContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.darkGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    gap: Spacing.xs,
  },
  chartBarWrapper: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBarValue: {
    fontSize: 9,
    color: C.gray,
    marginBottom: 2,
  },
  chartBarTrack: {
    width: '100%',
    height: 60,
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 3,
    minHeight: 3,
  },
  chartBarLabel: {
    fontSize: 10,
    color: C.gray,
    marginTop: 4,
  },
  chartBarLabelToday: {
    color: C.accent,
    fontWeight: '700',
  },

  // Kategori
  categoriesSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: C.lightGray,
  },
  categoriesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.darkGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.offWhite,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    gap: 4,
  },
  categoryTagEmoji: {
    fontSize: 13,
  },
  categoryTagLabel: {
    fontSize: 12,
    color: C.charcoal,
    fontWeight: '500',
  },
  categoryTagBadge: {
    backgroundColor: C.primary,
    borderRadius: 99,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTagCount: {
    fontSize: 10,
    color: C.white,
    fontWeight: '700',
  },

  // ── Highlight Kartı ──────────────────────────
  highlightCard: {
    backgroundColor: C.accent,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
    ...Shadows.md,
  },
  highlightStarEmoji: {
    fontSize: 32,
    marginBottom: Spacing.xs,
  },
  highlightSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.white + 'CC',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  highlightText: {
    fontSize: 16,
    color: C.white,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '600',
  },

  // ── Insights Kartları (Güçlü / Gelişim) ──────
  insightsCard: {
    backgroundColor: C.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  insightsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  insightsSectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  insightsDotStrength: {
    backgroundColor: C.success,
  },
  insightsDotImprovement: {
    backgroundColor: C.warning,
  },
  insightsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.primary,
  },
  insightsSectionSub: {
    fontSize: 12,
    color: C.gray,
    marginBottom: Spacing.md,
    marginLeft: 18,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  insightRowStrength: {
    backgroundColor: C.success + '10',
  },
  insightRowImprovement: {
    backgroundColor: C.warning + '10',
  },
  insightIconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    marginTop: 1,
    flexShrink: 0,
  },
  insightIconBoxStrength: {
    backgroundColor: C.success,
  },
  insightIconBoxImprovement: {
    backgroundColor: C.warning,
  },
  insightIcon: {
    fontSize: 12,
    color: C.white,
    fontWeight: '900',
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: C.charcoal,
    lineHeight: 21,
  },

  // ── Gelecek Hafta Kartı ───────────────────────
  nextWeekCard: {
    backgroundColor: C.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: C.primary,
    ...Shadows.sm,
  },
  nextWeekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  nextWeekEmoji: {
    fontSize: 22,
    marginRight: Spacing.sm,
  },
  nextWeekTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.primary,
  },
  nextWeekFocusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.darkGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  nextWeekFocusText: {
    fontSize: 14,
    color: C.charcoal,
    lineHeight: 21,
    marginBottom: Spacing.md,
  },
  techniqueBox: {
    backgroundColor: C.offWhite,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  techniqueLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  techniqueLabelEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  techniqueLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  techniqueName: {
    fontSize: 18,
    fontWeight: '800',
    color: C.primary,
    marginBottom: 6,
  },
  techniqueReason: {
    fontSize: 13,
    color: C.darkGray,
    lineHeight: 19,
  },

  // ── Kapanış Kartı ─────────────────────────────
  closingCard: {
    backgroundColor: C.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  closingQuoteMark: {
    fontSize: 48,
    color: C.accent,
    lineHeight: 48,
    fontWeight: '900',
    marginBottom: -8,
  },
  closingText: {
    fontSize: 15,
    color: C.secondary,
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
  },

  // ── Yenile & Meta ─────────────────────────────
  refreshButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  refreshButtonText: {
    fontSize: 14,
    color: C.darkGray,
    fontWeight: '500',
  },
  generatedAt: {
    fontSize: 11,
    color: C.gray,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
});