package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

var (
	firebaseAuth    *auth.Client
	firestoreClient *firestore.Client
)

// Data Structures
type WeekItem struct {
	Day        int         `firestore:"day" json:"day"`
	ExtraCount int         `firestore:"extraCount" json:"extraCount"`
	ID         interface{} `firestore:"id" json:"id"` // String və ya Number ola bilər
	Images     []string    `firestore:"images" json:"images"`
	Subtitle   string      `firestore:"subtitle" json:"subtitle"`
	Title      string      `firestore:"title" json:"title"`
	Type       string      `firestore:"type" json:"type"`
}

type ProgramWeeksDoc struct {
	CreatedAt interface{}           `firestore:"createdAt" json:"createdAt"`
	UserID    string                `firestore:"userId" json:"userId"`
	Weeks     map[string][]WeekItem `firestore:"weeks" json:"weeks"`
}

// authMiddleware gələn sorğulardakı Firebase ID Token-i yoxlayır
func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// CORS Headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// "Authorization: Bearer <token>" başlığını (header) alırıq
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization başlığı tapılmadı", http.StatusUnauthorized)
			return
		}

		// Token hissəsini ayırırıq
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || strings.ToLower(tokenParts[0]) != "bearer" {
			http.Error(w, "Yanlış Authorization formatı. 'Bearer <token>' olmalıdır", http.StatusUnauthorized)
			return
		}
		idToken := tokenParts[1]

		// Token-i Firebase ilə doğrulayırıq
		token, err := firebaseAuth.VerifyIDToken(context.Background(), idToken)
		if err != nil {
			http.Error(w, fmt.Sprintf("Token etibarsızdır: %v", err), http.StatusUnauthorized)
			return
		}

		// Token-i context-ə əlavə edirik ki, handler-lər istifadə edə bilsin
		ctx := context.WithValue(r.Context(), "userToken", token)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// getProgramWeeksHandler proqramın həftəlik məlumatlarını qaytarır
func getProgramWeeksHandler(w http.ResponseWriter, r *http.Request) {
	// Query parametrlərindən programId-ni alırıq
	programId := r.URL.Query().Get("programId")
	if programId == "" {
		http.Error(w, "programId parametri tələb olunur", http.StatusBadRequest)
		return
	}

	// Context-dən user tokenini alırıq (authMiddleware-dən gəlir)
	token := r.Context().Value("userToken").(*auth.Token)
	uid := token.UID

	ctx := context.Background()

	// Firestore-dan sənədi oxuyuruq
	log.Printf("Firestore request for doc: %s", programId)
	doc, err := firestoreClient.Collection("user_program_weeks").Doc(programId).Get(ctx)
	if err != nil {
		log.Printf("Firestore Get error: %v", err)
		// Sənəd tapılmadıqda 404 qaytar
		if strings.Contains(err.Error(), "NotFound") {
			http.Error(w, "Proqram tapılmadı", http.StatusNotFound)
			return
		}
		http.Error(w, fmt.Sprintf("Firestore xətası: %v", err), http.StatusInternalServerError)
		return
	}

	var data ProgramWeeksDoc
	if err := doc.DataTo(&data); err != nil {
		log.Printf("DataTo error: %v", err)
		// Fallback: Try to load into map to see what fields are problematic
		var rawData map[string]interface{}
		if err2 := doc.DataTo(&rawData); err2 == nil {
			log.Printf("Raw data loaded successfully (for debug): %+v", rawData)
			
			// Xüsusilə 'weeks' sahəsini yoxlayaq
			if weeksVal, ok := rawData["weeks"]; ok {
				log.Printf("'weeks' sahəsinin tipi: %T", weeksVal)
				log.Printf("'weeks' sahəsinin dəyəri: %+v", weeksVal)
			} else {
				log.Printf("'weeks' sahəsi tapılmadı!")
			}
		}
		http.Error(w, fmt.Sprintf("Data parse xətası: %v", err), http.StatusInternalServerError)
		return
	}

	// Təhlükəsizlik yoxlaması: Bu proqram həqiqətən bu istifadəçiyə aiddir?
	if data.UserID != uid {
		http.Error(w, "Bu məlumatı görmək üçün icazəniz yoxdur", http.StatusForbidden)
		return
	}

	// JSON olaraq qaytarırıq
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		http.Error(w, fmt.Sprintf("JSON encode xətası: %v", err), http.StatusInternalServerError)
	}
}

// secureDataHandler yalnız doğrulanan istifadəçilərə məlumat qaytarır
func secureDataHandler(w http.ResponseWriter, r *http.Request) {
	// Bura yalnız token-i düzgün olanlar girə bilər!
	// Gələcəkdə burada Firestore-dan məlumat çəkəcəyik
	fmt.Fprintf(w, "Təbrik edirik! Siz Firebase ilə təsdiqlənmiş istifadəçisiniz. Budur sizin gizli məlumatlarınız.")
}

func main() {
	// 1. Firebase üçün context yaradırıq
	ctx := context.Background()

	// 2. Service Account faylımızı göstəririk
	opt := option.WithCredentialsFile("serviceAccountKey.json")

	// 3. Firebase Tətbiqini inisializasiya edirik
	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		log.Fatalf("Firebase inisializasiya xətası: %v\n", err)
	}

	// 4. Firebase Auth klientini yaradırıq (Token yoxlamaq üçün)
	firebaseAuth, err = app.Auth(ctx)
	if err != nil {
		log.Fatalf("Firebase Auth xətası: %v\n", err)
	}

	// 5. Firestore klientini yaradırıq (Məlumat bazası üçün)
	firestoreClient, err = app.Firestore(ctx)
	if err != nil {
		log.Fatalf("Firestore xətası: %v\n", err)
	}
	defer firestoreClient.Close()

	fmt.Println("Firebase (Auth və Firestore) uğurla qoşuldu!")

	// Rotalar (Routes)
	// Açıq rota (Token tələb etmir)
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "GreenFit Go Backend işləyir! (Açıq səhifə)")
	})

	// Qorunan rota (Token TƏLƏB edir)
	http.HandleFunc("/api/data", authMiddleware(secureDataHandler))

	// YENİ: Proqram həftələrini gətirən rota
	http.HandleFunc("/api/program-weeks", authMiddleware(getProgramWeeksHandler))

	fmt.Println("Server http://localhost:8080 ünvanında dinləyir...")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
