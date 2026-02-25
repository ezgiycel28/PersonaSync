import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Vibration,
  TextInput,
  ScrollView,
  Modal,
  Switch,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { PersonaSyncColors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { StatusBar } from 'expo-status-bar';

// --- SABİTLER VE TİPLER ---
const QUICK_DURATIONS = [5, 15, 25, 60 ,120];

// Çalışma modları
type TimerMode = 'WORK' | 'SHORT_BREAK' | 'LONG_BREAK';

export default function PomodoroScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  // --- STATE YÖNETİMİ ---

  // Sayaç Değerleri
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [milliseconds, setMilliseconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<TimerMode>('WORK');

  // Kilit State'i (Görünmez)
  const [isInteractionLocked, setIsInteractionLocked] = useState(false);

  // İlerleme Takibi
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  
  // --- AYARLAR & MODAL STATE'LERİ ---
  const [showSettings, setShowSettings] = useState(false);
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState('');
  
  // 1. Çalışma Süresi
  const [workDuration, setWorkDuration] = useState(25);
  
  // 2. Mola Ayarları
  const [shortBreakDuration, setShortBreakDuration] = useState(5);
  const [breaksEnabled, setBreaksEnabled] = useState(true);
  
  // 3. Uzun Mola Ayarları
  const [longBreakDuration, setLongBreakDuration] = useState(20);
  const [longBreakInterval, setLongBreakInterval] = useState(4);
  const [longBreaksEnabled, setLongBreaksEnabled] = useState(true);

  // 4. Otomasyon ve Görünüm
  const [autoStart, setAutoStart] = useState(true);
  const [showMilliseconds, setShowMilliseconds] = useState(false);
  
  // Refler
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const longPressRef = useRef<NodeJS.Timeout | null>(null);

  // --- GÜNLÜK HEDEF ---
  const dailyTarget = user?.daily_study_target || 60;
  const totalSessionMinutes = completedPomodoros * workDuration;
  const progressPercentage = Math.min(100, Math.round((totalSessionMinutes / dailyTarget) * 100));
  
  // --- AKILLI MOD GEÇİŞİ (YENİ EKLENDİ) ---
  // Ayarlardan mola kapatılırsa anında Work moduna dön
  useEffect(() => {
    if (!breaksEnabled && (mode === 'SHORT_BREAK' || mode === 'LONG_BREAK')) {
      switchToWorkMode();
    }
  }, [breaksEnabled]);

  // Uzun mola kapatılırsa ve şu an uzun moladaysak Work moduna dön
  useEffect(() => {
    if (!longBreaksEnabled && mode === 'LONG_BREAK') {
      switchToWorkMode();
    }
  }, [longBreaksEnabled]);

  // Yardımcı Fonksiyon: Zorla Çalışma Moduna Geç
  const switchToWorkMode = () => {
    setMode('WORK');
    setMinutes(workDuration);
    setSeconds(0);
    setMilliseconds(0);
    setIsActive(false); // Karışıklık olmasın diye durdur
  };

  // --- ZAMANLAYICI MANTIĞI ---
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        if (milliseconds > 0) {
          setMilliseconds(ms => ms - 1);
        } else {
          if (seconds > 0) {
            setSeconds(s => s - 1);
            setMilliseconds(9);
          } else {
            if (minutes > 0) {
              setMinutes(m => m - 1);
              setSeconds(59);
              setMilliseconds(9);
            } else {
              handleTimerComplete();
            }
          }
        }
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isActive, minutes, seconds, milliseconds]);

  // --- SÜRE BİTİŞ MANTIĞI ---
  const handleTimerComplete = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    Vibration.vibrate([0, 500, 200, 500]);
    
    if (mode === 'WORK') {
      setCompletedPomodoros(prev => prev + 1);
      setCurrentStreak(prev => prev + 1);
      
      if (breaksEnabled) {
        const isLongBreak = longBreaksEnabled && ((completedPomodoros + 1) % longBreakInterval === 0);
        if (isLongBreak) {
          switchToMode('LONG_BREAK');
        } else {
          switchToMode('SHORT_BREAK');
        }
      } else {
        // Molalar kapalıysa direkt başa sar (Work)
        resetTimer(); 
      }
    } else {
      // Mola bitti -> Çalışmaya dön
      switchToMode('WORK');
    }

    // Eğer mola kapalıysa ve Work bittiyse resetTimer çağrıldığı için isActive false olur.
    // Ancak autoStart varsa tekrar başlatmalıyız.
    // resetTimer isActive'i false yapar, bu yüzden burada kontrol edip açıyoruz.
    if (autoStart) {
      // Ufak bir gecikme ile state güncellensin
      setTimeout(() => setIsActive(true), 100);
    } else {
      setIsActive(false);
    }
  };

  const switchToMode = (newMode: TimerMode) => {
    setMode(newMode);
    let newDuration = workDuration;
    if (newMode === 'SHORT_BREAK') newDuration = shortBreakDuration;
    if (newMode === 'LONG_BREAK') newDuration = longBreakDuration;
    setMinutes(newDuration);
    setSeconds(0);
    setMilliseconds(0);
  };

  // --- KULLANICI ETKİLEŞİMLERİ ---

  const toggleTimer = () => {
    if (isInteractionLocked) return;
    setIsActive(!isActive);
  };

  // Basılı Tutma (Reset) Mantığı
  const handlePressIn = () => {
    if (isInteractionLocked) return;

    longPressRef.current = setTimeout(() => {
      resetTimer(); 
      Vibration.vibrate([0, 50, 50, 50]); 
      
      setIsInteractionLocked(true);
      setTimeout(() => {
        setIsInteractionLocked(false);
      }, 2000); 

    }, 1500); 
  };

  const handlePressOut = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  // GÜNCELLENDİ: Reset her zaman Çalışma Moduna (WORK) döndürür
  const resetTimer = () => {
    setIsActive(false); 
    setMode('WORK'); // Temayı ve modu zorla WORK yap
    setMinutes(workDuration); // Süreyi çalışma süresi yap
    setSeconds(0);
    setMilliseconds(0);
  };

  // Hızlı Süre Seçimi
  const selectDuration = (duration: number) => {
    if (isInteractionLocked) return;
    setWorkDuration(duration);
    setMode('WORK'); 
    setMinutes(duration);
    setSeconds(0);
    setMilliseconds(0);
    setIsActive(false);
  };

  // Özel Süre Ayarlama
  const setCustomTime = () => {
    const duration = parseInt(customDurationInput);
    if (duration >= 1 && duration <= 720) {
      selectDuration(duration);
      setShowCustomDuration(false);
      setCustomDurationInput('');
    } else {
      Alert.alert('Hata', 'Lütfen 1 ile 720 arasında bir dakika girin.');
    }
  };

  // Formatlı Zaman
  const formatTime = () => {
    const min = String(minutes).padStart(2, '0');
    const sec = String(seconds).padStart(2, '0');
    const ms = String(milliseconds);
    
    if (showMilliseconds) return `${min}:${sec}.${ms}`;
    return `${min}:${sec}`;
  };

  const necklaceProgress = completedPomodoros % 10;

  // Renkler
  const getModeColor = () => {
    if (mode === 'WORK') return PersonaSyncColors.primary;
    if (mode === 'SHORT_BREAK') return '#4CAF50'; 
    if (mode === 'LONG_BREAK') return '#2196F3'; 
    return PersonaSyncColors.primary;
  };

  const getModeLabel = () => {
    if (mode === 'WORK') return 'Çalışma Zamanı 👨‍💻';
    if (mode === 'SHORT_BREAK') return 'Kısa Mola ☕';
    if (mode === 'LONG_BREAK') return 'Uzun Mola 🌳';
  };

  return (
    <View style={[styles.container, { backgroundColor: getModeColor() }]}>
      <StatusBar style="light" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')}>
          <Text style={styles.backButtonText}>← Anasayfa</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Pomodoro</Text>
        
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Text style={styles.settingsEmoji}>🍎</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* İlerleme Gerdanlığı */}
        <View style={styles.necklaceContainer}>
          <Text style={styles.necklaceTitle}>🔮 İlerleme Gerdanlığı</Text>
          <View style={styles.necklaceBeads}>
            {[...Array(10)].map((_, index) => (
              <View
                key={index}
                style={[
                  styles.bead,
                  index < necklaceProgress && styles.beadFilled
                ]}
              />
            ))}
          </View>
          <Text style={styles.necklaceProgress}>{necklaceProgress}/10 Döngü</Text>
        </View>

        {/* TIMER ÇEMBERİ */}
        <View style={styles.timerContainer}>
          <Text style={[styles.modeLabel, { color: getModeColor() }]}>
            {getModeLabel()}
          </Text>
          
          <TouchableOpacity 
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={toggleTimer}
            activeOpacity={0.9} 
            style={[
              styles.timerCircle,
              isActive && { borderColor: getModeColor() },
            ]}
          >
            <Text style={[styles.timerText, showMilliseconds && styles.timerTextSmall]}>
              {formatTime()}
            </Text>
            
            <Text style={styles.timerLabel}>
              {isActive ? '⏸ Duraklat' : '▶ Başlat'}
            </Text>

            <Text style={styles.timerHint}>
              1.5sn basılı tut = Sıfırla
            </Text>
          </TouchableOpacity>
        </View>

        {/* SÜRE SEÇİM BUTONLARI */}
        {(!isActive && mode === 'WORK') && (
          <View style={styles.durationContainer}>
            <Text style={styles.durationTitle}>⏱️ Çalışma Süresi Seç</Text>
            <View style={styles.durationButtons}>
              {QUICK_DURATIONS.map((duration) => (
                <TouchableOpacity
                  key={duration}
                  style={[
                    styles.durationButton,
                    workDuration === duration && { backgroundColor: getModeColor() }
                  ]}
                  onPress={() => selectDuration(duration)}
                >
                  <Text style={[
                    styles.durationButtonText,
                    workDuration === duration && styles.durationButtonTextActive
                  ]}>
                    {duration}dk
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.durationButton, styles.customButton]}
                onPress={() => setShowCustomDuration(true)}
              >
                <Text style={styles.durationButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* İSTATİSTİKLER PANELİ */}
        <View style={styles.statsPanel}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>🔥</Text>
              <View>
                <Text style={styles.statValue}>{currentStreak}</Text>
                <Text style={styles.statLabel}>Seri</Text>
              </View>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>✅</Text>
              <View>
                <Text style={styles.statValue}>{completedPomodoros}</Text>
                <Text style={styles.statLabel}>Toplam</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.statsSeparator} />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>🚀</Text>
              <View>
                <Text style={styles.statValue}>{dailyTarget} dk</Text>
                <Text style={styles.statLabel}>Hedef</Text>
              </View>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>⚡</Text>
              <View>
                <Text style={styles.statValue}>%{progressPercentage}</Text>
                <Text style={styles.statLabel}>İlerleme</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>💡 Bilgi</Text>
          <Text style={styles.tipsText}>
            • 🍎 ikonuna basarak mola ve otomasyon ayarlarını yapabilirsin.{'\n'}
            • Mola sırasında molaları kapatırsan otomatik olarak çalışma moduna dönersin.
          </Text>
        </View>
      </ScrollView>

      {/* ÖZEL SÜRE MODALI */}
      <Modal
        visible={showCustomDuration}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Özel Süre (Dakika)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              placeholder="1-720"
              placeholderTextColor={PersonaSyncColors.gray}
              value={customDurationInput}
              onChangeText={setCustomDurationInput}
              maxLength={3}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowCustomDuration(false);
                  setCustomDurationInput('');
                }}
              >
                <Text style={styles.modalButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: getModeColor() }]}
                onPress={setCustomTime}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>
                  Ayarla
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* AYARLAR MODALI */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.settingsModalContainer}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsHeaderTitle}>🍎 Pomodoro Ayarları</Text>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Text style={styles.closeButtonText}>Kapat</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.settingsContent}>
            
            {/* 1. MOLA AYARLARI */}
            <View style={styles.settingSection}>
              <Text style={styles.sectionTitle}>☕ Mola Ayarları</Text>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Molalar Aktif</Text>
                <Switch 
                  value={breaksEnabled} 
                  onValueChange={setBreaksEnabled}
                  trackColor={{ false: '#ddd', true: PersonaSyncColors.accent }}
                />
              </View>

              {breaksEnabled && (
                <View style={styles.subSettings}>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Kısa Mola (1-10 dk)</Text>
                    <View style={styles.counterControl}>
                      <TouchableOpacity 
                        onPress={() => setShortBreakDuration(Math.max(1, shortBreakDuration - 1))}
                        style={styles.counterButton}
                      >
                        <Text style={styles.counterButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.counterValue}>{shortBreakDuration} dk</Text>
                      <TouchableOpacity 
                        onPress={() => setShortBreakDuration(Math.min(10, shortBreakDuration + 1))}
                        style={styles.counterButton}
                      >
                        <Text style={styles.counterButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* 2. UZUN MOLA AYARLARI */}
            <View style={styles.settingSection}>
              <Text style={styles.sectionTitle}>🌳 Uzun Mola</Text>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Uzun Mola Aktif</Text>
                <Switch 
                  value={longBreaksEnabled} 
                  onValueChange={setLongBreaksEnabled}
                  trackColor={{ false: '#ddd', true: PersonaSyncColors.accent }}
                />
              </View>

              {longBreaksEnabled && (
                <View style={styles.subSettings}>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Sıklık (Pomodoro)</Text>
                    <View style={styles.counterControl}>
                      <TouchableOpacity 
                        onPress={() => setLongBreakInterval(Math.max(1, longBreakInterval - 1))}
                        style={styles.counterButton}
                      >
                        <Text style={styles.counterButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.counterValue}>{longBreakInterval}</Text>
                      <TouchableOpacity 
                        onPress={() => setLongBreakInterval(longBreakInterval + 1)}
                        style={styles.counterButton}
                      >
                        <Text style={styles.counterButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Süre (10-120 dk)</Text>
                    <View style={styles.counterControl}>
                      <TouchableOpacity 
                        onPress={() => setLongBreakDuration(Math.max(10, longBreakDuration - 5))}
                        style={styles.counterButton}
                      >
                        <Text style={styles.counterButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.counterValue}>{longBreakDuration} dk</Text>
                      <TouchableOpacity 
                        onPress={() => setLongBreakDuration(Math.min(120, longBreakDuration + 5))}
                        style={styles.counterButton}
                      >
                        <Text style={styles.counterButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* 3. GENEL AYARLAR */}
            <View style={styles.settingSection}>
              <Text style={styles.sectionTitle}>⚙️ Genel</Text>
              
              <View style={styles.settingRow}>
                <View>
                  <Text style={styles.settingLabel}>Otomatik Başlat</Text>
                  <Text style={styles.settingDesc}>Süre bitince diğerine otomatik geç</Text>
                </View>
                <Switch 
                  value={autoStart} 
                  onValueChange={setAutoStart}
                  trackColor={{ false: '#ddd', true: PersonaSyncColors.accent }}
                />
              </View>

              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Salise Göster</Text>
                <Switch 
                  value={showMilliseconds} 
                  onValueChange={setShowMilliseconds}
                  trackColor={{ false: '#ddd', true: PersonaSyncColors.accent }}
                />
              </View>
            </View>

          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    transition: 'background-color 0.5s ease',
  },
  header: {
    paddingTop: 60,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: PersonaSyncColors.white,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PersonaSyncColors.white,
  },
  settingsButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  settingsEmoji: {
    fontSize: 22,
  },
  content: {
    flex: 1,
    backgroundColor: PersonaSyncColors.offWhite,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  
  // Gerdanlık
  necklaceContainer: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.md,
  },
  necklaceTitle: { fontSize: 14, fontWeight: '600', color: PersonaSyncColors.primary, marginBottom: 8 },
  necklaceBeads: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  bead: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#e0e0e0', borderWidth: 1, borderColor: '#ccc' },
  beadFilled: { backgroundColor: PersonaSyncColors.accent, borderColor: PersonaSyncColors.accentDark, transform: [{ scale: 1.1 }] },
  necklaceProgress: { fontSize: 12, color: PersonaSyncColors.gray, marginTop: 4 },
  
  // Timer
  timerContainer: { alignItems: 'center', marginVertical: Spacing.md },
  modeLabel: { fontSize: 18, fontWeight: 'bold', marginBottom: Spacing.md, opacity: 0.8 },
  timerCircle: {
    width: 260, height: 260, borderRadius: 130, borderWidth: 8, borderColor: '#ddd',
    justifyContent: 'center', alignItems: 'center', backgroundColor: PersonaSyncColors.white, ...Shadows.md
  },
  timerText: { fontSize: 56, fontWeight: 'bold', color: PersonaSyncColors.primary, fontVariant: ['tabular-nums'] },
  timerTextSmall: { fontSize: 42 }, 
  timerLabel: { fontSize: 18, color: PersonaSyncColors.darkGray, marginTop: Spacing.sm, fontWeight: '600' },
  timerHint: { fontSize: 12, color: PersonaSyncColors.gray, marginTop: Spacing.xs, fontStyle: 'italic' },
  
  // Süre Butonları
  durationContainer: { backgroundColor: PersonaSyncColors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadows.sm },
  durationTitle: { fontSize: 15, fontWeight: 'bold', color: PersonaSyncColors.primary, marginBottom: Spacing.md, textAlign: 'center' },
  durationButtons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  durationButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f0f0f0' },
  customButton: { backgroundColor: PersonaSyncColors.secondary },
  durationButtonText: { fontSize: 14, fontWeight: '600', color: '#555' },
  durationButtonTextActive: { color: 'white' },

  // İstatistikler Paneli
  statsPanel: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    ...Shadows.sm
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  statEmoji: { fontSize: 24 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: PersonaSyncColors.primary },
  statLabel: { fontSize: 12, color: 'gray' },
  statsDivider: { width: 1, height: 30, backgroundColor: '#eee' },
  statsSeparator: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
  
  tipsContainer: { marginBottom: 40 },
  tipsTitle: { fontWeight: 'bold', color: PersonaSyncColors.primary, marginBottom: 4 },
  tipsText: { fontSize: 12, color: 'gray', lineHeight: 18 },

  // --- MODAL STYLES ---
  settingsModalContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee' },
  settingsHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: PersonaSyncColors.primary },
  closeButtonText: { fontSize: 16, color: 'blue', fontWeight: '600' },
  settingsContent: { padding: 20 },
  settingSection: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 20, ...Shadows.sm },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: PersonaSyncColors.primary, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  subSettings: { marginTop: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#eee' },
  settingLabel: { fontSize: 15, color: '#333' },
  settingDesc: { fontSize: 11, color: '#888', marginTop: 2 },
  
  counterControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8 },
  counterButton: { padding: 8, width: 36, alignItems: 'center' },
  counterButtonText: { fontSize: 18, fontWeight: 'bold', color: PersonaSyncColors.primary },
  counterValue: { paddingHorizontal: 8, fontSize: 14, fontWeight: '600', minWidth: 50, textAlign: 'center' },

  // Custom Time Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', borderRadius: 16, padding: 24, width: '80%', alignItems: 'center', ...Shadows.lg },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: PersonaSyncColors.primary },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, width: '100%', textAlign: 'center', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  modalButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: '#f0f0f0' },
  modalButtonText: { fontWeight: '600', color: '#555' },
  modalButtonTextConfirm: { color: 'white' },
});