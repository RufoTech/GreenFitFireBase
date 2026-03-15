import { MaterialIcons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');

const PRIMARY = "#ccff00";
const BG_DARK = "#12140a";
const SURFACE_DARK = "#1c1f0f";
const BORDER_DARK = "#2a2e18";
const TEXT_COLOR = "#f1f5f9";
const SUBTEXT_COLOR = "#94a3b8";

const WEEKS = ["WEEK 1", "WEEK 2", "WEEK 3", "WEEK 4"];

// API URL - Android Emulator üçün 10.0.2.2, digərləri üçün localhost
const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export default function WeeklyProgramScreen() {
  const router = useRouter();
  const { programId } = useLocalSearchParams();
  const [activeWeek, setActiveWeek] = useState("WEEK 1");
  const [loading, setLoading] = useState(true);
  const [programData, setProgramData] = useState<any>(null);
  const [weekSchedule, setWeekSchedule] = useState<any[]>([]);

  useEffect(() => {
    fetchProgramWeeks();
  }, [programId]);

  useEffect(() => {
    if (programData && programData.weeks) {
        updateWeekSchedule();
    }
  }, [activeWeek, programData]);

  const fetchProgramWeeks = async () => {
    if (!programId) {
        setLoading(false);
        return;
    }

    try {
        const user = auth().currentUser;
        if (!user) return;

        const token = await user.getIdToken();
        
        console.log(`Fetching from: ${API_URL}/api/program-weeks?programId=${programId}`);

        const response = await fetch(`${API_URL}/api/program-weeks?programId=${programId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Program Data Received:", JSON.stringify(data, null, 2));
        setProgramData(data);
    } catch (error) {
        console.error("Error fetching program weeks:", error);
        Alert.alert("Error", "Failed to load program schedule. Please check your connection.");
    } finally {
        setLoading(false);
    }
  };

  const updateWeekSchedule = () => {
      // activeWeek formatı "WEEK 1", bizə sadəcə rəqəm lazımdır: "1"
      const weekNum = activeWeek.split(' ')[1];
      const weeksData = programData.weeks || {};
      const currentWeekData = weeksData[weekNum] || [];

      // Datanı UI formatına çeviririk
      const formattedSchedule = currentWeekData.map((item: any) => {
          let duration = 0;
          let exercises = 0;

          // DEBUG LOG - Her bir item için image kontrolü
          console.log(`Processing Day ${item.day} (${item.title}):`, {
              hasImages: !!item.images,
              imagesArray: item.images,
              firstImage: item.images && item.images.length > 0 ? item.images[0] : "NONE"
          });

          if (item.subtitle) {
              const parts = item.subtitle.split('•');
              if (parts.length > 0) {
                  // "3 exercises" -> 3
                  const exPart = parts[0].trim().split(' ')[0];
                  exercises = parseInt(exPart) || 0;
              }
              if (parts.length > 1) {
                  // "45 Min" -> 45
                  const durPart = parts[1].trim().split(' ')[0];
                  duration = parseInt(durPart) || 0;
              }
          }

          // Gelen resim URL'sini temizle (Backtick, tırnak ve boşlukları kaldır)
          let imageUrl = null;
          if (item.images && item.images.length > 0) {
              const rawUrl = item.images[0];
              if (typeof rawUrl === 'string') {
                  imageUrl = rawUrl.replace(/[`"'\s]/g, '');
              }
          }

          return {
              day: item.day,
              title: item.title,
              type: item.type || 'workout',
              duration: duration,
              exercises: exercises,
              image: imageUrl,
              focus: item.title, // Title-ı focus kimi istifadə edirik hələlik
              isCurrent: false, // Bunu real tarixə görə hesablamaq olar
              note: item.subtitle // Rest day üçün
          };
      });

      // Sort by day
      formattedSchedule.sort((a: any, b: any) => a.day - b.day);

      // Əgər günlər əksikdirsə, Rest Day kimi doldura bilərik (Opsional)
      // Hələlik olduğu kimi saxlayırıq
      setWeekSchedule(formattedSchedule);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />
      
      {/* Header Navigation */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
            <TouchableOpacity 
                style={styles.backButton}
                onPress={() => router.back()}
            >
                <MaterialIcons name="arrow-back" size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Program Schedule</Text>
        </View>
        <TouchableOpacity style={styles.menuButton}>
            <MaterialIcons name="more-vert" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      {/* Weekly Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            {WEEKS.map((week) => (
                <TouchableOpacity
                    key={week}
                    style={[styles.tab, activeWeek === week && styles.activeTab]}
                    onPress={() => setActiveWeek(week)}
                >
                    <Text style={[styles.tabText, activeWeek === week && styles.activeTabText]}>{week}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        <View style={styles.scheduleHeader}>
            <Text style={styles.scheduleTitle}>{activeWeek} Schedule</Text>
            <Text style={styles.scheduleSubtitle}>Follow the plan to maximize results</Text>
        </View>

        {loading ? (
            <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />
        ) : weekSchedule.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ color: SUBTEXT_COLOR }}>No workouts found for this week.</Text>
            </View>
        ) : (
            /* Day List */
            <View style={styles.daysList}>
                {weekSchedule.map((item) => {
                    // isCurrent məntiqi (nümunə üçün ilk elementi current edək)
                    const isCurrent = false; // Gələcəkdə real məntiqlə əvəz etmək olar

                    if (isCurrent) {
                        return (
                            <View key={item.day} style={styles.currentDayCard}>
                                <View style={styles.currentDayHeader}>
                                    <View style={styles.dayInfo}>
                                        <Text style={styles.currentDayLabel}>CURRENT DAY</Text>
                                        <Text style={styles.dayTitle}>Day {item.day}: {item.title}</Text>
                                        <View style={styles.dayMeta}>
                                            <MaterialIcons name="schedule" size={14} color={SUBTEXT_COLOR} />
                                            <Text style={styles.metaText}>{item.duration} min</Text>
                                            <Text style={styles.metaDot}>•</Text>
                                            <MaterialIcons name="fitness-center" size={14} color={SUBTEXT_COLOR} />
                                            <Text style={styles.metaText}>{item.exercises} exercises</Text>
                                        </View>
                                    </View>
                                    <View style={styles.boltIconContainer}>
                                        <MaterialIcons name="bolt" size={24} color={PRIMARY} />
                                    </View>
                                </View>

                                {item.image && (
                                    <View style={styles.heroImageContainer}>
                                        <Image 
                                            source={{ uri: item.image }} 
                                            style={styles.heroImage} 
                                            onError={(e) => console.log("Image load error:", e.nativeEvent.error)}
                                        />
                                        <LinearGradient
                                            colors={['transparent', 'rgba(0,0,0,0.8)']}
                                            style={styles.imageOverlay}
                                        />
                                        <Text style={styles.focusText}>Focus: {item.focus}</Text>
                                    </View>
                                )}

                                <TouchableOpacity 
                                    style={styles.startWorkoutButton}
                                    onPress={() => router.push('/screens/WorkoutStartScreen')}
                                >
                                    <MaterialIcons name="play-circle-filled" size={24} color={BG_DARK} />
                                    <Text style={styles.startWorkoutText}>START WORKOUT</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    }

                    if (item.type === 'rest') {
                        return (
                            <View key={item.day} style={styles.restDayCard}>
                                <View style={styles.restDayContent}>
                                    <View style={styles.dayInfo}>
                                        <Text style={styles.dayTitle}>Day {item.day}: {item.title}</Text>
                                        <Text style={styles.restNote}>{item.note || "Rest & Recover"}</Text>
                                    </View>
                                    <MaterialIcons 
                                        name="hotel"
                                        size={24} 
                                        color="rgba(204, 255, 0, 0.6)" 
                                    />
                                </View>
                            </View>
                        );
                    }

                    return (
                        <View key={item.day} style={styles.dayCard}>
                            <View style={styles.dayCardContent}>
                                <View style={styles.dayInfo}>
                                    <Text style={styles.dayTitle}>Day {item.day}: {item.title}</Text>
                                    <View style={styles.dayMeta}>
                                        <MaterialIcons name="schedule" size={14} color={SUBTEXT_COLOR} />
                                        <Text style={styles.metaText}>{item.duration} min • {item.exercises} exercises</Text>
                                    </View>
                                </View>
                                {item.image ? (
                                    <Image 
                                        source={{ uri: item.image }} 
                                        style={{ width: 60, height: 60, borderRadius: 8, marginLeft: 12 }} 
                                        resizeMode="cover"
                                        onError={(e) => console.log("Thumbnail error:", e.nativeEvent.error)}
                                    />
                                ) : (
                                    <MaterialIcons 
                                        name="fitness-center"
                                        size={24} 
                                        color={SUBTEXT_COLOR} 
                                    />
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_DARK,
    backgroundColor: 'rgba(18, 20, 10, 0.8)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  menuButton: {
    padding: 8,
    marginRight: -8,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER_DARK,
  },
  tabsContent: {
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    minWidth: 80,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: PRIMARY,
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: SUBTEXT_COLOR,
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: PRIMARY,
  },
  content: {
    padding: 16,
  },
  scheduleHeader: {
    marginBottom: 16,
  },
  scheduleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  scheduleSubtitle: {
    fontSize: 14,
    color: SUBTEXT_COLOR,
  },
  daysList: {
    gap: 16,
  },
  currentDayCard: {
    backgroundColor: SURFACE_DARK,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.3)',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  currentDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dayInfo: {
    flex: 1,
    gap: 4,
  },
  currentDayLabel: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  dayMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: SUBTEXT_COLOR,
  },
  metaDot: {
    fontSize: 12,
    color: SUBTEXT_COLOR,
  },
  boltIconContainer: {
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    padding: 8,
    borderRadius: 8,
  },
  heroImageContainer: {
    width: '100%',
    aspectRatio: 16/9,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  focusText: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  startWorkoutButton: {
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  startWorkoutText: {
    color: BG_DARK,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  dayCard: {
    backgroundColor: SURFACE_DARK,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  dayCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restDayCard: {
    backgroundColor: 'rgba(28, 31, 15, 0.4)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    borderStyle: 'dashed',
  },
  restDayContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    opacity: 0.7,
  },
  restNote: {
    fontSize: 12,
    color: SUBTEXT_COLOR,
    fontStyle: 'italic',
  },
});
