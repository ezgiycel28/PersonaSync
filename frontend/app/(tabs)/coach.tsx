/**
 * PersonaSync — AI Koç Ekranı (Güncellenmiş)
 * ============================================
 * CoachCard ve WeeklyReportCard bileşenlerini kullanır.
 * Bu dosya sadece state yönetimi ve layout'tan sorumludur —
 * kart detayları bileşen dosyalarına taşındı.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { PersonaSyncColors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

// Bileşenler
import { CoachCard, type FeedbackState } from '@/components/coach-card';
import { WeeklyReportCard } from '@/components/weekly-report';

// API
import {
  getDailyAdvice,
  getWeeklyReport,
  getMotivation,
  sendFeedback,
  getAIErrorMessage,
  isAuthError,
  type DailyAdvice,
  type WeeklyReport,
  type Motivation,
  type AlternativeTechnique,
  type MotivationTrigger,
} from '@/services/ai_coach_api';

// ─────────────────────────────────────────────
// Yardımcılar
// ─────────────────────────────────────────────

function getTodayLabel(): string {
  return new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function getGreeting(name: string): string {
  const h = new Date().getHours();
  const prefix = h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
  return `${prefix}, ${name} 👋`;
}

// ─────────────────────────────────────────────
// Tekrar kullanılan küçük bileşenler
// ─────────────────────────────────────────────

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEmoji}>{emoji}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function SkeletonCard({ lines = 4 }: { lines?: number }) {
  const anim = useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [anim]);

  return (
    <View style={styles.skeletonCard}>
      {Array.from({ length: lines }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.skeletonLine,
            { opacity: anim, width: i === lines - 1 ? '55%' : '100%' },
          ]}
        />
      ))}
    </View>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorCard}>
      <Text style={styles.errorEmoji}>⚠️</Text>
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
        <Text style={styles.retryBtnText}>Tekrar Dene</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────
// ANA EKRAN
// ─────────────────────────────────────────────

export default function CoachScreen() {
  const { user, token, logout } = useAuth();

  // ── Günlük Öneri ────────────────────────────
  const [advice, setAdvice] = useState<DailyAdvice | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  // ── Feedback ────────────────────────────────
  const [feedbackState, setFeedbackState] = useState<FeedbackState>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [alternative, setAlternative] = useState<AlternativeTechnique | null>(null);

  // ── Motivasyon ──────────────────────────────
  const [motivation, setMotivation] = useState<Motivation | null>(null);
  const [motivationLoading, setMotivationLoading] = useState(false);
  const [motivationError, setMotivationError] = useState<string | null>(null);
  const [motivationVisible, setMotivationVisible] = useState(false);

  // ── Haftalık Rapor ──────────────────────────
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);

  // ── Genel ───────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);

  // ─────────────────────────────────────────
  // Auth hata merkezi
  // ─────────────────────────────────────────
  const handleAuthError = useCallback(
    (error: unknown): boolean => {
      if (isAuthError(error)) {
        Alert.alert('Oturum Sona Erdi', 'Lütfen tekrar giriş yapın.', [
          { text: 'Tamam', onPress: logout },
        ]);
        return true;
      }
      return false;
    },
    [logout],
  );

  // ─────────────────────────────────────────
  // Günlük Öneri
  // ─────────────────────────────────────────
  const loadDailyAdvice = useCallback(async () => {
    if (!token) return;
    setAdviceLoading(true);
    setAdviceError(null);
    setFeedbackState(null);
    setAlternative(null);

    try {
      const data = await getDailyAdvice(token);
      setAdvice(data);
    } catch (e) {
      if (!handleAuthError(e)) setAdviceError(getAIErrorMessage(e));
    } finally {
      setAdviceLoading(false);
    }
  }, [token, handleAuthError]);

  useFocusEffect(
    useCallback(() => {
      // Eğer daha önce hata aldıysak sonsuz döngüye girmemesi için !adviceError ekledik
      if (!advice && !adviceLoading && !adviceError) {
        loadDailyAdvice();
      }
    }, [advice, adviceLoading, adviceError, loadDailyAdvice]),
  );

  // ─────────────────────────────────────────
  // Pull-to-refresh
  // ─────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setAdvice(null);
    setMotivation(null);
    setMotivationVisible(false);
    setReport(null);
    setReportVisible(false);
    await loadDailyAdvice();
    setRefreshing(false);
  }, [loadDailyAdvice]);

  // ─────────────────────────────────────────
  // Feedback
  // ─────────────────────────────────────────
  const handleFeedback = useCallback(
    async (liked: boolean) => {
      if (!token || !advice || feedbackState) return;
      setFeedbackLoading(true);

      try {
        const result = await sendFeedback(token, {
          technique: advice.technique,
          liked,
          advice_type: 'daily',
        });
        setFeedbackState(liked ? 'liked' : 'disliked');
        if (!liked && result.alternative) setAlternative(result.alternative);
      } catch (e) {
        if (!handleAuthError(e)) Alert.alert('Hata', getAIErrorMessage(e));
      } finally {
        setFeedbackLoading(false);
      }
    },
    [token, advice, feedbackState, handleAuthError],
  );

  // ─────────────────────────────────────────
  // Motivasyon
  // ─────────────────────────────────────────
  const loadMotivation = useCallback(
    async (trigger: MotivationTrigger = 'user_request', note?: string) => {
      if (!token) return;
      setMotivationLoading(true);
      setMotivationError(null);
      setMotivationVisible(true);
      setMotivation(null);

      try {
        const data = await getMotivation(token, { trigger, user_note: note });
        setMotivation(data);
      } catch (e) {
        if (!handleAuthError(e)) setMotivationError(getAIErrorMessage(e));
      } finally {
        setMotivationLoading(false);
      }
    },
    [token, handleAuthError],
  );

  // ─────────────────────────────────────────
  // Haftalık Rapor
  // ─────────────────────────────────────────
  const loadWeeklyReport = useCallback(async () => {
    if (!token) return;
    setReportLoading(true);
    setReportError(null);
    setReportVisible(true);
    setReport(null);

    try {
      const data = await getWeeklyReport(token, { days: 7 });
      setReport(data);
    } catch (e) {
      if (!handleAuthError(e)) setReportError(getAIErrorMessage(e));
    } finally {
      setReportLoading(false);
    }
  }, [token, handleAuthError]);

  // ─────────────────────────────────────────
  const firstName = (user?.full_name ?? 'Koçun').split(' ')[0];

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerDate}>{getTodayLabel()}</Text>
          <Text style={styles.headerGreeting}>{getGreeting(firstName)}</Text>
          <Text style={styles.headerSub}>Koçun seni bekliyor 🤖</Text>
        </View>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarEmoji}>🧠</Text>
        </View>
      </View>

      {/* SCROLL */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PersonaSyncColors.accent}
            colors={[PersonaSyncColors.accent]}
          />
        }
      >

        {/* ══════════════════════════════
            BÖLÜM 1 — GÜNLÜK ÖNERİ
        ══════════════════════════════ */}
        <SectionHeader emoji="🎯" title="Günlük Önerin" />

        {adviceLoading && <SkeletonCard lines={5} />}

        {!adviceLoading && adviceError && (
          <ErrorCard message={adviceError} onRetry={loadDailyAdvice} />
        )}

        {/* ↓ CoachCard bileşeni */}
        {!adviceLoading && advice && (
          <>
            <CoachCard
              advice={advice}
              feedbackState={feedbackState}
              feedbackLoading={feedbackLoading}
              onLike={() => handleFeedback(true)}
              onDislike={() => handleFeedback(false)}
            />

            {/* Alternatif teknik — beğenilmeme sonrası */}
            {feedbackState === 'disliked' && alternative && (
              <CoachCard
                advice={alternative}
                isAlternative
              />
            )}
          </>
        )}

        {!adviceLoading && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={loadDailyAdvice}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>🔄 Farklı öneri al</Text>
          </TouchableOpacity>
        )}

        <View style={styles.divider} />

        {/* ══════════════════════════════
            BÖLÜM 2 — MOTİVASYON
        ══════════════════════════════ */}
        <SectionHeader emoji="⚡" title="Motivasyon" />

        {!motivationVisible && (
          <TouchableOpacity
            style={styles.motivationTriggerBtn}
            onPress={() => loadMotivation('user_request')}
            activeOpacity={0.85}
          >
            <Text style={styles.motivationTriggerEmoji}>💪</Text>
            <View>
              <Text style={styles.motivationTriggerTitle}>Motivasyon Al</Text>
              <Text style={styles.motivationTriggerSub}>
                Koçundan kişisel bir mesaj
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {motivationLoading && <SkeletonCard lines={3} />}

        {!motivationLoading && motivationVisible && motivationError && (
          <ErrorCard
            message={motivationError}
            onRetry={() => loadMotivation('user_request')}
          />
        )}

        {!motivationLoading && motivation && (
          <View style={styles.motivationCard}>
            <Text style={styles.motivationCardTitle}>{motivation.title}</Text>
            <Text style={styles.motivationCardMessage}>{motivation.message}</Text>

            <View style={styles.motivationActionBox}>
              <Text style={styles.motivationActionLabel}>Şimdi yap:</Text>
              <Text style={styles.motivationActionText}>{motivation.action}</Text>
            </View>

            <View style={styles.motivationReminderRow}>
              <Text style={styles.motivationReminderIcon}>🎯</Text>
              <Text style={styles.motivationReminderText}>{motivation.reminder}</Text>
            </View>

            <TouchableOpacity
              style={styles.motivationReloadBtn}
              onPress={() => loadMotivation('user_request')}
              activeOpacity={0.8}
            >
              <Text style={styles.motivationReloadText}>Başka bir mesaj al 🔄</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.divider} />

        {/* ══════════════════════════════
            BÖLÜM 3 — HAFTALIK RAPOR
        ══════════════════════════════ */}
        <SectionHeader emoji="📊" title="Haftalık Rapor" />

        {!reportVisible && (
          <TouchableOpacity
            style={styles.reportTriggerBtn}
            onPress={loadWeeklyReport}
            activeOpacity={0.85}
          >
            <View style={styles.reportTriggerLeft}>
              <Text style={styles.reportTriggerEmoji}>📈</Text>
              <View>
                <Text style={styles.reportTriggerTitle}>Bu Haftanı Analiz Et</Text>
                <Text style={styles.reportTriggerSub}>Son 7 günün koçluk raporu</Text>
              </View>
            </View>
            <Text style={styles.reportTriggerArrow}>›</Text>
          </TouchableOpacity>
        )}

        {reportLoading && (
          <View style={styles.reportLoadingCard}>
            <ActivityIndicator size="large" color={PersonaSyncColors.accent} />
            <Text style={styles.reportLoadingText}>Haftanı analiz ediyorum...</Text>
            <Text style={styles.reportLoadingSubText}>Bu işlem 3-5 saniye sürebilir</Text>
          </View>
        )}

        {!reportLoading && reportVisible && reportError && (
          <ErrorCard message={reportError} onRetry={loadWeeklyReport} />
        )}

        {/* ↓ WeeklyReportCard bileşeni */}
        {!reportLoading && report && (
          <WeeklyReportCard
            report={report}
            onRefresh={loadWeeklyReport}
          />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const C = PersonaSyncColors;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primary },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flex: 1 },
  headerDate: { fontSize: 12, color: C.secondary, textTransform: 'capitalize', letterSpacing: 0.5 },
  headerGreeting: { fontSize: 22, fontWeight: '700', color: C.white, marginTop: 2 },
  headerSub: { fontSize: 13, color: C.secondary, marginTop: 2 },
  headerAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.accent,
    justifyContent: 'center', alignItems: 'center',
    ...Shadows.md,
  },
  headerAvatarEmoji: { fontSize: 26 },

  // Scroll
  scroll: {
    flex: 1,
    backgroundColor: C.offWhite,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  scrollContent: { padding: Spacing.lg, paddingTop: Spacing.xl },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  sectionEmoji: { fontSize: 20, marginRight: Spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: C.primary },

  // Skeleton
  skeletonCard: {
    backgroundColor: C.white, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.sm,
  },
  skeletonLine: {
    height: 14, backgroundColor: C.lightGray,
    borderRadius: 7, marginBottom: Spacing.sm,
  },

  // Error
  errorCard: {
    backgroundColor: C.white, borderRadius: BorderRadius.lg,
    padding: Spacing.xl, marginBottom: Spacing.md,
    alignItems: 'center', ...Shadows.sm,
  },
  errorEmoji: { fontSize: 36, marginBottom: Spacing.sm },
  errorText: { fontSize: 14, color: C.darkGray, textAlign: 'center', marginBottom: Spacing.md, lineHeight: 20 },
  retryBtn: {
    backgroundColor: C.accent, paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, borderRadius: BorderRadius.md,
  },
  retryBtnText: { color: C.white, fontWeight: '600', fontSize: 14 },

  // Secondary button
  secondaryBtn: { alignItems: 'center', paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
  secondaryBtnText: { fontSize: 14, color: C.darkGray, fontWeight: '500' },

  // Divider
  divider: { height: 1, backgroundColor: C.lightGray, marginVertical: Spacing.lg },

  // Motivasyon trigger
  motivationTriggerBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 2, borderColor: C.accent, gap: Spacing.md, ...Shadows.sm,
  },
  motivationTriggerEmoji: { fontSize: 32 },
  motivationTriggerTitle: { fontSize: 16, fontWeight: '700', color: C.primary },
  motivationTriggerSub: { fontSize: 12, color: C.darkGray, marginTop: 2 },

  // Motivasyon kartı
  motivationCard: {
    backgroundColor: C.primary, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.md,
  },
  motivationCardTitle: { fontSize: 20, fontWeight: '800', color: C.white, marginBottom: Spacing.sm },
  motivationCardMessage: { fontSize: 15, color: C.secondary, lineHeight: 23, marginBottom: Spacing.md },
  motivationActionBox: {
    backgroundColor: C.primaryLight, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  motivationActionLabel: {
    fontSize: 11, fontWeight: '700', color: C.accent,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  motivationActionText: { fontSize: 14, color: C.white, fontWeight: '600', lineHeight: 20 },
  motivationReminderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
  motivationReminderIcon: { fontSize: 14, marginRight: Spacing.xs, marginTop: 2 },
  motivationReminderText: { flex: 1, fontSize: 13, color: C.gray, fontStyle: 'italic', lineHeight: 19 },
  motivationReloadBtn: {
    alignItems: 'center', paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: C.primaryLight,
  },
  motivationReloadText: { fontSize: 13, color: C.secondary, fontWeight: '500' },

  // Rapor trigger
  reportTriggerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.white, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.sm,
  },
  reportTriggerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  reportTriggerEmoji: { fontSize: 32 },
  reportTriggerTitle: { fontSize: 16, fontWeight: '700', color: C.primary },
  reportTriggerSub: { fontSize: 12, color: C.darkGray, marginTop: 2 },
  reportTriggerArrow: { fontSize: 28, color: C.accent, fontWeight: '300' },

  // Rapor loading
  reportLoadingCard: {
    backgroundColor: C.white, borderRadius: BorderRadius.lg,
    padding: Spacing.xl, alignItems: 'center',
    marginBottom: Spacing.md, ...Shadows.sm,
  },
  reportLoadingText: { fontSize: 16, fontWeight: '600', color: C.primary, marginTop: Spacing.md },
  reportLoadingSubText: { fontSize: 13, color: C.darkGray, marginTop: Spacing.xs },
});