/**
 * PersonaSync — CoachCard Bileşeni
 * ==================================
 * AI Koç günlük öneri kartı.
 * coach.tsx ekranında kullanılır, bağımsız ve yeniden kullanılabilir.
 *
 * Props:
 *   advice          — DailyAdvice veya AlternativeTechnique verisi
 *   onLike          — 👍 butonuna basıldığında
 *   onDislike       — 👎 butonuna basıldığında
 *   feedbackState   — null | 'liked' | 'disliked' (buton durumu)
 *   feedbackLoading — feedback isteği devam ediyor mu
 *   isAlternative   — alternatif teknik kartı mı (farklı stil)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { PersonaSyncColors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import type { DailyAdvice, AlternativeTechnique } from '@/services/ai_coach_api';

// ─────────────────────────────────────────────
// Tip tanımları
// ─────────────────────────────────────────────

export type FeedbackState = null | 'liked' | 'disliked';

interface CoachCardProps {
  advice: DailyAdvice | AlternativeTechnique;
  onLike?: () => void;
  onDislike?: () => void;
  feedbackState?: FeedbackState;
  feedbackLoading?: boolean;
  isAlternative?: boolean;
}

// DailyAdvice mi AlternativeTechnique mi ayırt et
function isDailyAdvice(a: DailyAdvice | AlternativeTechnique): a is DailyAdvice {
  return 'why_this_works' in a;
}

// ─────────────────────────────────────────────
// Alt Bileşenler
// ─────────────────────────────────────────────

function StepRow({ index, text }: { index: number; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{index + 1}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function FeedbackButtons({
  feedbackState,
  feedbackLoading,
  onLike,
  onDislike,
}: {
  feedbackState: FeedbackState;
  feedbackLoading: boolean;
  onLike?: () => void;
  onDislike?: () => void;
}) {
  if (feedbackState !== null) {
    return (
      <View style={styles.feedbackResultBox}>
        <Text style={styles.feedbackResultText}>
          {feedbackState === 'liked'
            ? '👍 Harika! Bu teknik beğeni listenize eklendi.'
            : '👎 Anlaşıldı! Daha uygun bir alternatif aranıyor...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.feedbackButtons}>
      <TouchableOpacity
        style={[styles.feedbackBtn, styles.feedbackBtnLike]}
        onPress={onLike}
        disabled={feedbackLoading}
        activeOpacity={0.8}
      >
        {feedbackLoading ? (
          <ActivityIndicator size="small" color={C.white} />
        ) : (
          <>
            <Text style={styles.feedbackBtnEmoji}>👍</Text>
            <Text style={styles.feedbackBtnText}>Evet, denerim!</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.feedbackBtn, styles.feedbackBtnDislike]}
        onPress={onDislike}
        disabled={feedbackLoading}
        activeOpacity={0.8}
      >
        <Text style={styles.feedbackBtnEmoji}>👎</Text>
        <Text style={[styles.feedbackBtnText, { color: C.darkGray }]}>
          Bana göre değil
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────
// Ana Bileşen
// ─────────────────────────────────────────────

export function CoachCard({
  advice,
  onLike,
  onDislike,
  feedbackState = null,
  feedbackLoading = false,
  isAlternative = false,
}: CoachCardProps) {
  const isDaily = isDailyAdvice(advice);

  // Kart giriş animasyonu
  const slideAnim = useRef(new Animated.Value(24)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.card,
        isAlternative && styles.cardAlternative,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {/* ── Başlık Bandı ─────────────────────── */}
      <View style={styles.headerRow}>
        <View style={[styles.badge, isAlternative && styles.badgeAlternative]}>
          <Text style={styles.badgeText}>
            {isAlternative ? '🔄 Alternatif Teknik' : '🎯 Bugünün Tekniği'}
          </Text>
        </View>
      </View>

      {/* ── Teknik Adı ───────────────────────── */}
      <Text style={styles.techniqueName}>
        {isDaily ? (advice as DailyAdvice).technique : (advice as AlternativeTechnique).technique}
      </Text>

      {/* ── Neden Uygun Kutusu ───────────────── */}
      <View style={styles.whyBox}>
        <Text style={styles.whyIcon}>💡</Text>
        <Text style={styles.whyText}>
          {isDaily
            ? (advice as DailyAdvice).why_this_works
            : (advice as AlternativeTechnique).why_suits_you}
        </Text>
      </View>

      {/* ── Günlük Öneri — Ekstra Alanlar ────── */}
      {isDaily && (
        <>
          {/* Süre Önerisi */}
          <View style={styles.durationRow}>
            <Text style={styles.durationIcon}>⏱</Text>
            <Text style={styles.durationText}>
              {(advice as DailyAdvice).duration_suggestion}
            </Text>
          </View>
        </>
      )}

      {/* ── Alternatif — Fark Açıklaması ─────── */}
      {!isDaily && (
        <View style={styles.diffBox}>
          <Text style={styles.diffLabel}>Farkı nedir?</Text>
          <Text style={styles.diffText}>
            {(advice as AlternativeTechnique).why_different}
          </Text>
        </View>
      )}

      {/* ── Adımlar ──────────────────────────── */}
      <Text style={styles.stepsLabel}>Nasıl Yapılır?</Text>
      {(isDaily
        ? (advice as DailyAdvice).steps
        : (advice as AlternativeTechnique).steps
      ).map((step, i) => (
        <StepRow key={i} index={i} text={step} />
      ))}

      {/* ── Günlük Öneri — Kategori Odağı ────── */}
      {isDaily && (
        <View style={styles.focusBox}>
          <Text style={styles.focusIcon}>📚</Text>
          <Text style={styles.focusText}>
            {(advice as DailyAdvice).category_focus}
          </Text>
        </View>
      )}

      {/* ── Alternatif — Deneme Önerisi ──────── */}
      {!isDaily && (
        <View style={styles.tryBox}>
          <Text style={styles.tryIcon}>💬</Text>
          <Text style={styles.tryText}>
            {(advice as AlternativeTechnique).try_suggestion}
          </Text>
        </View>
      )}

      {/* ── Motivasyon Notu (sadece günlük) ──── */}
      {isDaily && (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            ✨ {(advice as DailyAdvice).motivational_note}
          </Text>
        </View>
      )}

      {/* ── Feedback Bölümü ──────────────────── */}
      {(onLike || onDislike) && (
        <View style={styles.feedbackSection}>
          <Text style={styles.feedbackLabel}>
            Bu öneri işine yarar mı?
          </Text>
          <FeedbackButtons
            feedbackState={feedbackState}
            feedbackLoading={feedbackLoading}
            onLike={onLike}
            onDislike={onDislike}
          />
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const C = PersonaSyncColors;

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardAlternative: {
    borderWidth: 2,
    borderColor: C.accent,
  },

  // Başlık
  headerRow: {
    marginBottom: Spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: C.accent + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  badgeAlternative: {
    backgroundColor: C.accent + '30',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Teknik adı
  techniqueName: {
    fontSize: 24,
    fontWeight: '800',
    color: C.primary,
    marginBottom: Spacing.md,
    lineHeight: 30,
  },

  // Neden uygun
  whyBox: {
    flexDirection: 'row',
    backgroundColor: C.offWhite,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  whyIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  whyText: {
    flex: 1,
    fontSize: 14,
    color: C.charcoal,
    lineHeight: 21,
  },

  // Süre
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  durationIcon: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  durationText: {
    fontSize: 14,
    color: C.darkGray,
    fontWeight: '500',
  },

  // Fark kutusu (alternatif)
  diffBox: {
    backgroundColor: C.accent + '10',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
  },
  diffLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  diffText: {
    fontSize: 13,
    color: C.charcoal,
    lineHeight: 19,
  },

  // Adımlar
  stepsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.darkGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    marginTop: 1,
    flexShrink: 0,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.white,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: C.charcoal,
    lineHeight: 21,
  },

  // Kategori odağı
  focusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.lightGray,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  focusIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  focusText: {
    flex: 1,
    fontSize: 14,
    color: C.charcoal,
    lineHeight: 20,
  },

  // Deneme önerisi (alternatif)
  tryBox: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    backgroundColor: C.offWhite,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  tryIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  tryText: {
    flex: 1,
    fontSize: 13,
    color: C.darkGray,
    lineHeight: 19,
    fontStyle: 'italic',
  },

  // Motivasyon notu
  noteBox: {
    backgroundColor: C.primary + '08',
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  noteText: {
    fontSize: 13,
    color: C.primary,
    fontStyle: 'italic',
    lineHeight: 19,
  },

  // Feedback
  feedbackSection: {
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: C.lightGray,
    paddingTop: Spacing.md,
  },
  feedbackLabel: {
    fontSize: 13,
    color: C.darkGray,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  feedbackBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  feedbackBtnLike: {
    backgroundColor: C.success,
  },
  feedbackBtnDislike: {
    backgroundColor: C.lightGray,
  },
  feedbackBtnEmoji: {
    fontSize: 16,
  },
  feedbackBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.white,
  },
  feedbackResultBox: {
    backgroundColor: C.offWhite,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  feedbackResultText: {
    fontSize: 13,
    color: C.darkGray,
    textAlign: 'center',
    lineHeight: 19,
  },
});