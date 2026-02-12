import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { PersonaSyncColors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };

  const getFirstName = () => {
    return user?.full_name?.split(' ')[0] || 'Kullanıcı';
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{getGreeting()} 👋</Text>
            <Text style={styles.userName}>{getFirstName()}</Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <Text style={styles.profileEmoji}>
              {user?.full_name?.charAt(0)?.toUpperCase() || '👤'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🎯</Text>
            <Text style={styles.statValue}>{user?.goal || '-'}</Text>
            <Text style={styles.statLabel}>Hedefin</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⏰</Text>
            <Text style={styles.statValue}>
              {user?.daily_study_target ? `${user.daily_study_target} dk` : '-'}
            </Text>
            <Text style={styles.statLabel}>Günlük Hedef</Text>
          </View>
        </View>

        {/* Today's Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Bugünkü İlerleme</Text>
            <Text style={styles.progressDate}>
              {new Date().toLocaleDateString('tr-TR', { 
                day: 'numeric', 
                month: 'long' 
              })}
            </Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '0%' }]} />
            </View>
            <Text style={styles.progressText}>0 / {user?.daily_study_target || 0} dakika</Text>
          </View>
          <TouchableOpacity 
            style={styles.startButton} 
            activeOpacity={0.8}
            onPress={() => router.push('/pomodoro')}
          >
            <Text style={styles.startButtonText}>🍅 Pomodoro Başlat</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Profil Bilgilerin</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📧 Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🎒 Meslek</Text>
            <Text style={styles.infoValue}>{user?.occupation || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🎂 Yaş</Text>
            <Text style={styles.infoValue}>{user?.age || '-'}</Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={logout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutButtonText}>🚪 Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PersonaSyncColors.primary,
  },
  header: {
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: PersonaSyncColors.secondary,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: PersonaSyncColors.white,
    marginTop: 2,
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: PersonaSyncColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  profileEmoji: {
    fontSize: 22,
    color: PersonaSyncColors.white,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    backgroundColor: PersonaSyncColors.offWhite,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: PersonaSyncColors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: PersonaSyncColors.primary,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: PersonaSyncColors.gray,
    marginTop: 2,
  },
  progressCard: {
    backgroundColor: PersonaSyncColors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PersonaSyncColors.primary,
  },
  progressDate: {
    fontSize: 14,
    color: PersonaSyncColors.gray,
  },
  progressBarContainer: {
    marginBottom: Spacing.md,
  },
  progressBar: {
    height: 12,
    backgroundColor: PersonaSyncColors.lightGray,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: PersonaSyncColors.accent,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    color: PersonaSyncColors.darkGray,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: PersonaSyncColors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.md,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: PersonaSyncColors.white,
  },
  infoCard: {
    backgroundColor: PersonaSyncColors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PersonaSyncColors.primary,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: PersonaSyncColors.lightGray,
  },
  infoLabel: {
    fontSize: 14,
    color: PersonaSyncColors.darkGray,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: PersonaSyncColors.charcoal,
  },
  logoutButton: {
    backgroundColor: PersonaSyncColors.white,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PersonaSyncColors.error,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: PersonaSyncColors.error,
  },
});