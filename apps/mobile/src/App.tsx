import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import {
  ApiError,
  categories,
  errorMessage,
  mapUrl,
  statuses,
  type Category,
  type Dashboard,
  type Prediction,
  type ReportDetail,
  type ReportPage,
  type Status,
  type User,
} from "@smart-waste/api-client";
import { api, apiUrl, getTokens, onSessionExpired } from "./api";
import { Button, Field, Loading, Notice, colors, s } from "./ui";

type Screen = "dashboard" | "reports" | "form" | "detail";
type Geo = { latitude: number; longitude: number; accuracy: number | null };
function dateLabel(value: string) {
  return new Date(value).toLocaleString("id-ID");
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.screen}>
        <StatusBar style="dark" />
        <Application />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
function Application() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [reportId, setReportId] = useState("");
  const [editReport, setEditReport] = useState<ReportDetail | undefined>();
  async function restore() {
    setLoading(true);
    setError("");
    try {
      if (await getTokens()) setUser(await api.me());
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401))
        setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    restore();
  }, []);
  useEffect(() => onSessionExpired(() => setUser(null)), []);
  if (!apiUrl)
    return (
      <View style={s.container}>
        <Text style={s.title}>Konfigurasi diperlukan</Text>
        <Notice
          error
          text="EXPO_PUBLIC_API_URL belum diatur. Tetapkan URL backend HTTPS sebelum build APK."
        />
      </View>
    );
  if (loading) return <Loading />;
  if (!user)
    return (
      <AuthScreen onLogin={setUser} initialError={error} retry={restore} />
    );
  return (
    <>
      <View
        style={[
          s.row,
          {
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          },
        ]}
      >
        <Text style={s.wordmark}>Smart Waste</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert(
              "Keluar akun?",
              "Anda dapat masuk kembali dengan email dan password.",
              [
                { text: "Batal", style: "cancel" },
                {
                  text: "Keluar",
                  onPress: async () => {
                    try {
                      await api.logout();
                      setUser(null);
                    } catch (e) {
                      Alert.alert("Gagal keluar", errorMessage(e));
                    }
                  },
                },
              ],
            )
          }
        >
          <Text style={s.muted}>Keluar</Text>
        </Pressable>
      </View>
      {screen === "dashboard" ? (
        <DashboardScreen
          user={user}
          create={() => {
            setEditReport(undefined);
            setScreen("form");
          }}
        />
      ) : screen === "reports" ? (
        <ReportsScreen
          open={(id) => {
            setReportId(id);
            setScreen("detail");
          }}
        />
      ) : screen === "form" ? (
        <ReportFormScreen
          report={editReport}
          done={(id) => {
            setReportId(id);
            setScreen("detail");
          }}
          cancel={() => setScreen("reports")}
        />
      ) : (
        <DetailScreen
          id={reportId}
          back={() => setScreen("reports")}
          edit={(report) => {
            setEditReport(report);
            setScreen("form");
          }}
        />
      )}
      <View style={s.nav}>
        {(
          [
            ["dashboard", "Ringkasan"],
            ["reports", "Riwayat"],
            ["form", "Buat laporan"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: screen === key }}
            key={key}
            style={[
              s.navItem,
              screen === key && { backgroundColor: "#e8efe3" },
            ]}
            onPress={() => {
              setEditReport(undefined);
              setScreen(key);
            }}
          >
            <Text
              style={[s.navText, screen === key && { color: colors.green }]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

function AuthScreen({
  onLogin,
  initialError,
  retry,
}: {
  onLogin: (u: User) => void;
  initialError: string;
  retry: () => void;
}) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: 48 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.wordmark}>Smart Waste</Text>
        <Text style={s.title}>
          {register ? "Buat akun pelapor" : "Lingkungan mulai dari laporan."}
        </Text>
        <Text style={s.body}>
          Kirim foto dan lokasi sampah, lalu pantau tindak lanjutnya.
        </Text>
        {initialError && (
          <>
            <Notice error text={initialError} />
            <Button title="Coba sambungkan kembali" onPress={retry} secondary />
          </>
        )}
        {error && <Notice error text={error} />}
        <View style={s.panel}>
          {register && (
            <Field
              label="Nama lengkap"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              maxLength={100}
            />
          )}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={register ? "new-password" : "current-password"}
            maxLength={128}
          />
          {register && <Text style={s.muted}>Minimal 10 karakter.</Text>}
          <Button
            disabled={busy}
            title={busy ? "Memproses…" : register ? "Buat akun" : "Masuk"}
            onPress={async () => {
              setError("");
              if (
                !email.trim() ||
                !password ||
                (register && (name.trim().length < 2 || password.length < 10))
              ) {
                setError(
                  "Lengkapi data. Nama minimal 2 karakter dan password akun baru minimal 10 karakter.",
                );
                return;
              }
              setBusy(true);
              try {
                onLogin(
                  await api.authenticate(register ? "register" : "login", {
                    email: email.trim(),
                    password,
                    ...(register ? { name: name.trim() } : {}),
                  }),
                );
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
        <Button
          secondary
          title={
            register ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"
          }
          onPress={() => {
            setRegister(!register);
            setError("");
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DashboardScreen({ user, create }: { user: User; create: () => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await api.request<Dashboard>("/dashboard"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <ScrollView
      contentContainerStyle={s.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={s.muted}>Halo, {user.name}</Text>
      <Text style={s.title}>Ringkasan laporan</Text>
      <Text style={s.body}>
        {user.role === "admin"
          ? "Statistik seluruh laporan. Pengelolaan Admin tersedia melalui website."
          : "Lihat perkembangan laporan yang Anda kirim."}
      </Text>
      {error && (
        <>
          <Notice text={error} error />
          <Button title="Coba lagi" onPress={load} secondary />
        </>
      )}
      {!data && loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <View style={[s.panel, { backgroundColor: colors.green }]}>
              <Text style={{ color: "#e4eee6" }}>Total laporan</Text>
              <Text style={[s.number, { color: "white", fontSize: 44 }]}>
                {data.total}
              </Text>
            </View>
            <View style={s.row}>
              {(Object.keys(statuses) as Status[]).map((key) => (
                <View key={key} style={s.stat}>
                  <Text style={s.muted}>{statuses[key]}</Text>
                  <Text style={s.number}>{data.by_status[key] || 0}</Text>
                </View>
              ))}
            </View>
            {data.total === 0 && (
              <Notice text="Belum ada laporan. Mulai dengan foto dan lokasi sampah di sekitar Anda." />
            )}
            <View style={s.panel}>
              <Text style={s.heading}>Kategori laporan</Text>
              {(Object.keys(categories) as Category[]).map((key) => (
                <View key={key} style={s.row}>
                  <Text style={s.body}>{categories[key]}</Text>
                  <Text style={s.body}>{data.by_category[key] || 0}</Text>
                </View>
              ))}
            </View>
          </>
        )
      )}
      <Button title="Buat laporan sampah" onPress={create} />
    </ScrollView>
  );
}

function ReportsScreen({ open }: { open: (id: string) => void }) {
  const [data, setData] = useState<ReportPage | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .request<ReportPage>(`/reports?${query}&page=${page}`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, page]);
  const apply = () => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({
      q,
      status,
      category,
      start_date: start,
      end_date: end,
    }))
      if (v) p.set(k, v);
    setPage(1);
    setQuery(p.toString());
  };
  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.title}>Riwayat laporan</Text>
      <View style={s.panel}>
        <Field
          label="Cari deskripsi atau ID"
          value={q}
          onChangeText={setQ}
          maxLength={200}
        />
        <Text style={s.label}>Status</Text>
        <View style={s.row}>
          {[["", "Semua"], ...Object.entries(statuses)].map(([key, label]) => (
            <Choice
              key={key}
              label={label}
              selected={status === key}
              onPress={() => setStatus(key)}
            />
          ))}
        </View>
        <Text style={s.label}>Kategori</Text>
        <View style={s.row}>
          {[["", "Semua"], ...Object.entries(categories)].map(
            ([key, label]) => (
              <Choice
                key={key}
                label={label}
                selected={category === key}
                onPress={() => setCategory(key)}
              />
            ),
          )}
        </View>
        <Field
          label="Dari tanggal (YYYY-MM-DD)"
          value={start}
          onChangeText={setStart}
          placeholder="2026-11-01"
        />
        <Field
          label="Sampai tanggal (YYYY-MM-DD)"
          value={end}
          onChangeText={setEnd}
          placeholder="2026-11-30"
        />
        <Button title="Cari laporan" onPress={apply} secondary />
      </View>
      {error && (
        <>
          <Notice text={error} error />
          <Button
            title="Coba lagi"
            onPress={() =>
              setQuery(query + (query ? "&" : "") + "retry=" + Date.now())
            }
            secondary
          />
        </>
      )}
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <Text style={s.muted}>{data.total} laporan ditemukan</Text>
            {!data.items.length && (
              <Notice text="Belum ada laporan pada filter ini." />
            )}
            {data.items.map((report) => (
              <Pressable
                key={report.id}
                accessibilityRole="button"
                onPress={() => open(report.id)}
                style={s.panel}
              >
                <Text style={s.status}>{statuses[report.status]}</Text>
                <Text style={s.heading} numberOfLines={2}>
                  {report.description}
                </Text>
                <Text style={s.muted}>
                  {categories[report.category]} · {dateLabel(report.created_at)}
                </Text>
                <Text style={s.muted}>
                  #{report.id.slice(0, 8)} · Buka detail
                </Text>
              </Pressable>
            ))}
            <View style={s.row}>
              <Button
                title="Sebelumnya"
                disabled={page === 1}
                onPress={() => setPage((p) => p - 1)}
                secondary
              />
              <Text style={s.muted}>Hal. {page}</Text>
              <Button
                title="Berikutnya"
                disabled={page * data.page_size >= data.total}
                onPress={() => setPage((p) => p + 1)}
                secondary
              />
            </View>
          </>
        )
      )}
    </ScrollView>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[s.chip, selected && s.selectedChip]}
    >
      <Text style={{ color: selected ? "white" : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

function ReportFormScreen({
  report,
  done,
  cancel,
}: {
  report?: ReportDetail;
  done: (id: string) => void;
  cancel: () => void;
}) {
  const [description, setDescription] = useState(report?.description || "");
  const [category, setCategory] = useState<Category>(
    report?.category || "organic",
  );
  const [geo, setGeo] = useState<Geo | null>(
    report
      ? {
          latitude: report.latitude,
          longitude: report.longitude,
          accuracy: report.accuracy,
        }
      : null,
  );
  const [photo, setPhoto] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});
  useEffect(() => {
    api.headers(false).then(setImageHeaders);
  }, []);
  async function pick(camera: boolean) {
    setError("");
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(
          "Izin foto/kamera ditolak. Buka pengaturan aplikasi untuk mengizinkannya; isi formulir Anda tetap tersimpan.",
        );
        return;
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.85,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.85,
          });
      if (!result.canceled) {
        const image = await manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1600 } }],
          { compress: 0.85, format: SaveFormat.JPEG },
        );
        setPhoto(image.uri);
        setPrediction(null);
        setNotice("");
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function appendPhoto(form: FormData) {
    if (photo)
      form.append("photo", {
        uri: photo,
        name: "report.jpg",
        type: "image/jpeg",
      } as unknown as Blob);
  }
  async function locate() {
    setBusy(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError(
          "Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan, lalu coba lagi.",
        );
        return;
      }
      const value = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setGeo({
        latitude: value.coords.latitude,
        longitude: value.coords.longitude,
        accuracy: value.coords.accuracy,
      });
    } catch {
      setError("Lokasi belum diperoleh. Pastikan GPS aktif dan coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  async function predict() {
    if (!photo) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    appendPhoto(form);
    try {
      const result = await api.request<Prediction>("/predictions", {
        method: "POST",
        body: form,
      });
      setPrediction(result);
      if (result.category) setCategory(result.category);
    } catch (e) {
      setNotice(`${errorMessage(e)} Pilih kategori secara manual.`);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setError("");
    if (!geo || (!photo && !report) || description.trim().length < 10) {
      setError(
        "Lengkapi foto, lokasi GPS, serta deskripsi minimal 10 karakter.",
      );
      return;
    }
    setBusy(true);
    const f = new FormData();
    appendPhoto(f);
    f.append("description", description.trim());
    f.append("category", category);
    f.append("latitude", String(geo.latitude));
    f.append("longitude", String(geo.longitude));
    if (geo.accuracy !== null) f.append("accuracy", String(geo.accuracy));
    try {
      const result = await api.request<ReportDetail>(
        report ? `/reports/${report.id}` : "/reports",
        { method: report ? "PATCH" : "POST", body: f },
      );
      done(result.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>{report ? "Edit laporan" : "Buat laporan"}</Text>
        <Text style={s.muted}>
          Sertakan foto yang jelas dan ambil lokasi dekat penemuan sampah.
        </Text>
        {error && <Notice error text={error} />}
        <View style={s.panel}>
          <Text style={s.heading}>1. Foto sampah</Text>
          {(photo || report) && (
            <Image
              accessibilityLabel="Pratinjau foto sampah"
              source={
                photo
                  ? { uri: photo }
                  : {
                      uri: `${api.baseUrl}/reports/${report!.id}/photo`,
                      headers: imageHeaders,
                    }
              }
              style={s.photo}
            />
          )}
          <View style={s.row}>
            <Button
              title="Ambil foto"
              disabled={busy}
              onPress={() => pick(true)}
              secondary
            />
            <Button
              title="Pilih dari galeri"
              disabled={busy}
              onPress={() => pick(false)}
              secondary
            />
          </View>
          <Button
            title="Analisis foto dengan AI"
            disabled={!photo || busy}
            onPress={predict}
            secondary
          />
          {notice && <Notice text={notice} />}{" "}
          {prediction && (
            <Notice
              text={`Saran: ${prediction.category ? categories[prediction.category] : "Tidak tersedia"}, confidence ${Math.round((prediction.confidence || 0) * 100)}%. ${prediction.confidence !== null && prediction.confidence < 0.7 ? "Confidence rendah. Periksa kategori." : "Koreksi kategori bila perlu."} Model hanya mengenali tiga kelas.`}
            />
          )}
        </View>
        <View style={s.panel}>
          <Text style={s.heading}>2. Keterangan</Text>
          <Text style={s.label}>Kategori akhir</Text>
          <View style={s.row}>
            {(Object.keys(categories) as Category[]).map((key) => (
              <Choice
                key={key}
                label={categories[key]}
                selected={category === key}
                onPress={() => setCategory(key)}
              />
            ))}
          </View>
          <Field
            label="Deskripsi"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={5000}
          />
          <Text style={s.muted}>
            {description.length}/5000 karakter, minimal 10.
          </Text>
        </View>
        <View style={s.panel}>
          <Text style={s.heading}>3. Lokasi GPS</Text>
          <Button
            title={geo ? "Perbarui lokasi GPS" : "Ambil lokasi GPS"}
            disabled={busy}
            onPress={locate}
            secondary
          />
          {geo && (
            <>
              <Text style={s.body}>
                {geo.latitude.toFixed(6)}, {geo.longitude.toFixed(6)}
              </Text>
              <Text style={s.muted}>
                Akurasi:{" "}
                {geo.accuracy === null
                  ? "tidak diketahui"
                  : `±${Math.round(geo.accuracy)} m`}
              </Text>
              <Button
                title="Lihat di Maps"
                onPress={() =>
                  Linking.openURL(mapUrl(geo.latitude, geo.longitude))
                }
                secondary
              />
            </>
          )}
        </View>
        <Button
          title={
            busy ? "Memproses…" : report ? "Simpan perubahan" : "Kirim laporan"
          }
          disabled={busy}
          onPress={submit}
        />
        <Button title="Batal" onPress={cancel} secondary />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DetailScreen({
  id,
  back,
  edit,
}: {
  id: string;
  back: () => void;
  edit: (r: ReportDetail) => void;
}) {
  const [data, setData] = useState<ReportDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [headers, setHeaders] = useState<Record<string, string>>({});
  async function load() {
    setLoading(true);
    setError("");
    try {
      const value = await api.request<ReportDetail>(`/reports/${id}`);
      setData(value);
      setHeaders(await api.headers(false));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [id]);
  return (
    <ScrollView
      contentContainerStyle={s.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Button title="Kembali ke riwayat" onPress={back} secondary />
      {error && (
        <>
          <Notice error text={error} />
          <Button title="Coba lagi" onPress={load} secondary />
        </>
      )}
      {!data && loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <Text style={s.title}>Detail laporan</Text>
            <Text style={s.status}>{statuses[data.status]}</Text>
            <Image
              accessibilityLabel="Foto laporan"
              source={{
                uri: `${api.baseUrl}/reports/${id}/photo?v=${encodeURIComponent(data.updated_at)}`,
                headers,
              }}
              style={s.photo}
            />
            <View style={s.panel}>
              <Text style={s.heading}>{categories[data.category]}</Text>
              <Text style={s.body}>{data.description}</Text>
              <Text style={s.muted}>
                {dateLabel(data.created_at)} · #{id.slice(0, 8)}
              </Text>
              <Text style={s.body}>
                {data.latitude.toFixed(6)}, {data.longitude.toFixed(6)}
              </Text>
              <Button
                title="Buka lokasi di Maps"
                onPress={() =>
                  Linking.openURL(mapUrl(data.latitude, data.longitude))
                }
                secondary
              />
            </View>
            <View style={s.panel}>
              <Text style={s.heading}>Riwayat penanganan</Text>
              {data.history.map((item) => (
                <View key={item.id}>
                  <Text style={s.label}>
                    {statuses[item.next_status as Status] || item.next_status}
                  </Text>
                  <Text style={s.muted}>{dateLabel(item.created_at)}</Text>
                  <Text style={s.body}>{item.note || "Status diperbarui"}</Text>
                </View>
              ))}
            </View>
            <View style={s.panel}>
              <Text style={s.heading}>Prediksi AI asli</Text>
              {data.predictions.map((p) => (
                <View key={p.id}>
                  <Text style={s.body}>
                    {p.category
                      ? `${categories[p.category]} · ${Math.round((p.confidence || 0) * 100)}%`
                      : "Prediksi tidak tersedia"}
                  </Text>
                  <Text style={s.muted}>
                    {p.model_version || "Belum ada model"} ·{" "}
                    {dateLabel(p.created_at)}
                  </Text>
                </View>
              ))}
            </View>
            {data.status === "pending" && (
              <>
                <Button
                  title="Edit laporan"
                  onPress={() => edit(data)}
                  secondary
                />
                <Button
                  title="Hapus dari daftar aktif"
                  secondary
                  onPress={() =>
                    Alert.alert(
                      "Arsipkan laporan?",
                      "Laporan ini akan dihapus dari daftar aktif.",
                      [
                        { text: "Batal", style: "cancel" },
                        {
                          text: "Arsipkan",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await api.request(`/reports/${id}`, {
                                method: "DELETE",
                              });
                              back();
                            } catch (e) {
                              setError(errorMessage(e));
                            }
                          },
                        },
                      ],
                    )
                  }
                />
              </>
            )}
          </>
        )
      )}
    </ScrollView>
  );
}
