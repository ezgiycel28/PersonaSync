import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWeeklyReports } from '@/services/api';


/**
 * Haftalık Raporlar Sayfası
 * Kullanıcının haftalık çalışma raporlarını gösterir
 */

interface WeeklyReport {
  id: number;
  user_id: number;
  week_start: string;
  week_end: string;
  created_at: string;
  stats: {
    total_sessions: number;
    completed_sessions: number;
    cancelled_sessions: number;
    total_minutes: number;
    category_breakdown: { [key: string]: number };
    daily_breakdown: { [key: string]: number };
    goal_achievement: number;
  };
  ai_message: string | null;
  is_viewed: boolean;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

export default function ReportingPage() {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('@personasync_token');
    console.log('Token:', token); // Debug için
    return token;
  } catch (error) {
    console.error('Token alınamadı:', error);
    return null;
  }
};

  // Fetch helper
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = await getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  };

// Tüm raporları yükle
const loadReports = async () => {
  try {
    setLoading(true);
    const token = await getAuthToken();
    
    if (!token) {
      setError('Lütfen giriş yapın');
      setLoading(false);
      return;
    }

    const data = await getWeeklyReports(token);
    setReports(data.reports);
    
    if (data.reports.length > 0) {
      setSelectedReport(data.reports[0]);
    }
  } catch (err: any) {
    setError('Raporlar yüklenirken hata oluştu: ' + err.message);
    console.error('Reporting error:', err);
  } finally {
    setLoading(false);
  }
};

  // Sayfa yüklendiğinde raporları getir
  useEffect(() => {
    loadReports();
  }, []);

  // Tarih formatlama
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Süre formatlama
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}s ${mins}dk`;
  };

  // Kategori isimlerini Türkçeleştir
  const getCategoryName = (category: string) => {
    const categoryNames: { [key: string]: string } = {
      'lesson': 'Ders Çalışma',
      'project': 'Proje',
      'reading': 'Okuma',
      'homework': 'Ödev',
      'personal': 'Kişisel Gelişim',
      'other': 'Diğer',
    };
    return categoryNames[category] || category;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Raporlar yükleniyor...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>❌ {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadReports}>
          <Text style={styles.buttonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Haftalık Raporlarım</Text>
      </View>

      {/* Rapor Listesi */}
      <View style={styles.reportsSection}>
        <Text style={styles.sectionTitle}>Geçmiş Raporlar</Text>
        
        {reports.map((report) => (
          <TouchableOpacity
            key={report.id}
            style={[
              styles.reportCard,
              selectedReport?.id === report.id && styles.reportCardActive
            ]}
            onPress={() => setSelectedReport(report)}
          >
            <View style={styles.reportCardHeader}>
              <Text style={styles.weekLabel}>
                {formatDate(report.week_start)} - {formatDate(report.week_end)}
              </Text>
              {!report.is_viewed && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>Yeni</Text>
                </View>
              )}
            </View>
            
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{report.stats.completed_sessions}</Text>
                <Text style={styles.statLabel}>Seans</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatDuration(report.stats.total_minutes)}</Text>
                <Text style={styles.statLabel}>Süre</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>%{report.stats.goal_achievement}</Text>
                <Text style={styles.statLabel}>Hedef</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Seçili Rapor Detayı */}
      {selectedReport && (
        <View style={styles.detailSection}>
          <Text style={styles.detailTitle}>
            📅 {formatDate(selectedReport.week_start)} - {formatDate(selectedReport.week_end)}
          </Text>

          {/* AI Mesajı */}
          {selectedReport.ai_message && (
            <View style={styles.aiMessageBox}>
              <Text style={styles.aiHeader}>🤖 Koçundan Mesaj</Text>
              <Text style={styles.aiMessage}>{selectedReport.ai_message}</Text>
            </View>
          )}

          {/* İstatistikler */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statBoxIcon}>🎯</Text>
              <Text style={styles.statBoxLabel}>Hedef Başarısı</Text>
              <Text style={styles.statBoxValue}>%{selectedReport.stats.goal_achievement}</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statBoxIcon}>⏱️</Text>
              <Text style={styles.statBoxLabel}>Toplam Süre</Text>
              <Text style={styles.statBoxValue}>{formatDuration(selectedReport.stats.total_minutes)}</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statBoxIcon}>✅</Text>
              <Text style={styles.statBoxLabel}>Tamamlanan</Text>
              <Text style={styles.statBoxValue}>{selectedReport.stats.completed_sessions}</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statBoxIcon}>❌</Text>
              <Text style={styles.statBoxLabel}>İptal Edilen</Text>
              <Text style={styles.statBoxValue}>{selectedReport.stats.cancelled_sessions}</Text>
            </View>
          </View>

          {/* Kategori Dağılımı */}
          <View style={styles.categorySection}>
            <Text style={styles.sectionTitle}>📚 Kategori Dağılımı</Text>
            {Object.entries(selectedReport.stats.category_breakdown).map(([category, minutes]) => (
              <View key={category} style={styles.categoryItem}>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{getCategoryName(category)}</Text>
                  <Text style={styles.categoryDuration}>{formatDuration(minutes)}</Text>
                </View>
                <View style={styles.categoryBar}>
                  <View
                    style={[
                      styles.categoryBarFill,
                      { width: `${(minutes / selectedReport.stats.total_minutes) * 100}%` }
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reportsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  reportCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  reportCardActive: {
    borderColor: '#667eea',
    backgroundColor: '#f0f4ff',
  },
  reportCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  weekLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  newBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  detailSection: {
    padding: 16,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  aiMessageBox: {
    backgroundColor: '#667eea',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  aiHeader: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  aiMessage: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statBoxIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statBoxLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statBoxValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  categorySection: {
    marginTop: 16,
  },
  categoryItem: {
    marginBottom: 16,
  },
  categoryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  categoryDuration: {
    fontSize: 14,
    color: '#6b7280',
  },
  categoryBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    backgroundColor: '#667eea',
  },
});