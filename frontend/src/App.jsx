import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
  AlertCircle,
  UserRound,
  UserCheck,
  UserX,
  Trash2,
  GraduationCap,
  Mail,
  Hash,
  Play,
  Plus,
  Square,
  ScanFace,
  Video,
  Sun,
  Moon,
} from "lucide-react";

const DEFAULT_API = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1"
).replace(/\/+$/, "");

const DEFAULT_SESSION = "78792313-2dea-45c8-b3b5-50bafe5628fc";
const DEFAULT_DATE = "2026-10-09";

function localDateString(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function StudentAvatar({ apiBase, studentId, name, size = 42 }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = (name || "?").split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  const imageUrl = studentId
    ? `${apiBase.replace(/\/+$/, "")}/students/${encodeURIComponent(studentId)}/face-photo`
    : "";

  useEffect(() => setImageFailed(false), [imageUrl]);

  return (
    <span className="student-avatar" style={{ width: size, height: size, minWidth: size, borderRadius: "50%", overflow: "hidden", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800, fontSize: Math.max(11, size * 0.31), background: "var(--avatar-bg, #dbeafe)", color: "var(--avatar-fg, #1d4ed8)", border: "1px solid var(--avatar-border, #bfdbfe)" }}>
      {imageUrl && !imageFailed ? (
        <img src={imageUrl} alt={`${name || "Student"} enrollment photo`} onError={() => setImageFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : initials}
    </span>
  );
}

function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem("faceattendance-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const [apiBase, setApiBase] = useState(DEFAULT_API);
  const [sessionId, setSessionId] = useState("");
  const [date, setDate] = useState(DEFAULT_DATE);
  const [page, setPage] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState(null);
  const [overviewSummary, setOverviewSummary] = useState(null);
  const [overviewRecords, setOverviewRecords] = useState([]);
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [sessionForm, setSessionForm] = useState({
    subject_id: "",
    session_date: DEFAULT_DATE,
    start_time: "09:00",
    end_time: "10:00",
    room: "",
    faculty_name: "",
  });
  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [subjectBusy, setSubjectBusy] = useState(false);
  const [subjectError, setSubjectError] = useState("");
  const [subjectMessage, setSubjectMessage] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState("");
  const [subjectForm, setSubjectForm] = useState({ code: "", name: "", department: "", semester: "" });
  const [deletingSessionId, setDeletingSessionId] = useState("");
  const [exportingSessionId, setExportingSessionId] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [manualStatuses, setManualStatuses] = useState({});
  const [savingStudentId, setSavingStudentId] = useState("");
  const [attendanceAdminMessage, setAttendanceAdminMessage] = useState("");
  const [attendanceAdminError, setAttendanceAdminError] = useState("");

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registrationMode, setRegistrationMode] = useState("upload");
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [faceImage, setFaceImage] = useState(null);
  const [facePreview, setFacePreview] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [studentForm, setStudentForm] = useState({
    first_name: "",
    last_name: "",
    enrollment_number: "",
    email: "",
    roll_number: "",
    department: "",
    semester: "",
    section: "",
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      window.localStorage.setItem("faceattendance-theme", theme);
    } catch {
      // Theme still works for this session if browser storage is unavailable.
    }
  }, [theme]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const liveStreamRef = useRef(null);
  const liveVideoRef = useRef(null);
  const liveCanvasRef = useRef(null);
  const liveInFlightRef = useRef(false);
  const liveTimerRef = useRef(null);
  const [liveActive, setLiveActive] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [liveMessage, setLiveMessage] = useState("Camera attendance is stopped.");
  const [liveDetections, setLiveDetections] = useState([]);
  const [liveSavedCount, setLiveSavedCount] = useState(0);
  const [savingDetectionId, setSavingDetectionId] = useState("");


  const apiRequest = useCallback(async (path, options = {}) => {
    const response = await fetch(`${apiBase.replace(/\/+$/, "")}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data);
      throw new Error(detail || `Request failed (${response.status})`);
    }
    return data;
  }, [apiBase]);

  const openSessionForm = useCallback(async () => {
    setSessionError("");
    setSessionMessage("");
    setSessionModalOpen(true);
    try {
      const data = await apiRequest("/subjects");
      const items = Array.isArray(data) ? data : data.items || data.subjects || [];
      setSubjects(items);
      setSessionForm((old) => ({ ...old, subject_id: old.subject_id || items[0]?.id || "" }));
    } catch (e) {
      setSessionError(`Could not load subjects: ${e.message}`);
    }
  }, [apiRequest]);

  function closeSessionForm() {
    if (sessionBusy) return;
    setSessionModalOpen(false);
    setSessionError("");
    setSessionMessage("");
  }

  async function createClassSession(event) {
    event.preventDefault();
    setSessionError("");
    setSessionMessage("");
    if (!sessionForm.subject_id || !sessionForm.session_date || !sessionForm.start_time || !sessionForm.end_time) {
      setSessionError("Please complete all required fields.");
      return;
    }
    if (sessionForm.end_time <= sessionForm.start_time) {
      setSessionError("End time must be later than start time.");
      return;
    }
    if (sessionForm.room.trim().length > 100) {
      setSessionError("Room must be 100 characters or fewer.");
      return;
    }
    if (sessionForm.faculty_name.trim().length > 150) {
      setSessionError("Faculty name must be 150 characters or fewer.");
      return;
    }
    setSessionBusy(true);
    try {
      const created = await apiRequest("/class-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: sessionForm.subject_id,
          session_date: sessionForm.session_date,
          start_time: sessionForm.start_time,
          end_time: sessionForm.end_time,
          room: sessionForm.room.trim() || null,
          faculty_name: sessionForm.faculty_name.trim() || null,
        }),
      });
      const newId = created.id || created.class_session_id || created.session_id;
      setSessionMessage("Class session created successfully.");
      if (newId) setSessionId(newId);
      setSessionModalOpen(false);
      setPage("Class sessions");
      setSearch("");
      await load();
    } catch (e) {
      setSessionError(e.message || "Could not create class session.");
    } finally {
      setSessionBusy(false);
    }
  }

  const openSubjectForm = (subject = null) => {
    setSubjectError("");
    setSubjectMessage("");
    setEditingSubjectId(subject?.id || "");
    setSubjectForm({ code: subject?.code || "", name: subject?.name || subject?.subject_name || "", department: subject?.department || "", semester: subject?.semester == null ? "" : String(subject.semester) });
    setSubjectFormOpen(true);
  };

  const saveSubject = async (event) => {
    event.preventDefault();
    setSubjectError("");
    setSubjectMessage("");
    if (!subjectForm.code.trim() || !subjectForm.name.trim()) {
      setSubjectError("Subject code and subject name are required.");
      return;
    }
    setSubjectBusy(true);
    try {
      const payload = { code: subjectForm.code.trim(), name: subjectForm.name.trim(), department: subjectForm.department.trim() || null, semester: subjectForm.semester ? Number(subjectForm.semester) : null };
      await apiRequest(editingSubjectId ? `/subjects/${encodeURIComponent(editingSubjectId)}` : "/subjects", {
        method: editingSubjectId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSubjectFormOpen(false);
      setSubjectMessage(editingSubjectId ? "Subject updated successfully." : "Subject created successfully.");
      await load();
    } catch (e) {
      setSubjectError(e.message || "Could not save subject.");
    } finally {
      setSubjectBusy(false);
    }
  };

  const deleteSubject = async (subject) => {
    const name = subject.name || subject.subject_name || subject.code || "this subject";
    if (!window.confirm(`Delete subject “${name}”? Subjects with class sessions cannot be deleted. Delete or reassign those sessions first.`)) return;
    setSubjectError("");
    setSubjectMessage("");
    try {
      await apiRequest(`/subjects/${encodeURIComponent(subject.id)}`, { method: "DELETE" });
      setSubjectMessage(`Deleted subject ${name}.`);
      await load();
    } catch (e) {
      setSubjectError(e.message || "Could not delete subject.");
    }
  };

  const deleteClassSession = async (session) => {
    const id = sessionIdentifier(session);
    const subject = sessionSubjectName(session);
    const day = session.session_date ? displayDate(session.session_date) : "undated session";
    if (!window.confirm(`Delete ${subject} session on ${day}?

This permanently deletes the class session and its attendance records. This cannot be undone.`)) return;
    setDeletingSessionId(id);
    try {
      await apiRequest(`/class-sessions/${encodeURIComponent(id)}?delete_attendance=true`, { method: "DELETE" });
      if (sessionId === id) setSessionId("");
      await load();
      window.alert("Class session deleted.");
    } catch (e) {
      window.alert(`Could not delete class session: ${e.message}`);
    } finally {
      setDeletingSessionId("");
    }
  };

  const startLiveAttendance = useCallback(async () => {
    if (!sessionId) {
      setLiveError("Select a class session before starting attendance.");
      return;
    }

    setLiveBusy(true);
    setLiveError("");
    setLiveDetections([]);
    setLiveSavedCount(0);
    setLiveMessage("Opening camera...");

    let stream = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera access is unavailable. Open this app on localhost or HTTPS."
        );
      }

      // Open the camera with a lighter initial resolution.
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      liveStreamRef.current = stream;

      // Attach and display the camera before waiting for the backend.
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play();
      }

      setLiveActive(true);
      setLiveMessage("Camera ready. Initializing face recognition...");

      // Initialize the backend after the preview is visible.
      const started = await apiRequest("/live-attendance/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          class_session_id: sessionId,
        }),
      });

      setLiveMessage(
        started.message ||
          "Live attendance started. Keep faces clearly visible."
      );
    } catch (e) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      liveStreamRef.current = null;

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = null;
      }

      setLiveActive(false);
      setLiveError(e.message || "Could not start live attendance.");
      setLiveMessage("Attendance could not be started.");
    } finally {
      setLiveBusy(false);
    }
  }, [apiRequest, sessionId]);



  useEffect(() => {
    if (!liveActive) return undefined;
    let cancelled = false;
    const sendFrame = async () => {
      if (cancelled || !liveActive) return;
      const video = liveVideoRef.current;
      const canvas = liveCanvasRef.current;
      if (!video || !canvas || video.readyState < 2 || liveInFlightRef.current) {
        liveTimerRef.current = setTimeout(sendFrame, 250);
        return;
      }
      liveInFlightRef.current = true;
      try {
        canvas.width = Math.min(video.videoWidth || 640, 960);
        canvas.height = Math.round(canvas.width * (video.videoHeight || 480) / (video.videoWidth || 640));
        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
        if (!blob || cancelled) return;
        const form = new FormData();
        form.append("class_session_id", sessionId);
        form.append("image", blob, "camera-frame.jpg");
        const data = await apiRequest("/live-attendance/process-frame", { method: "POST", body: form });
        if (!cancelled) {
          setLiveDetections(Array.isArray(data.detections) ? data.detections : []);
          setLiveSavedCount(Number(data.saved_count || 0));
          if (data.message) setLiveMessage(data.message);
          setLiveError("");
        }
      } catch (e) {
        if (!cancelled) setLiveError(e.message || "Frame processing failed.");
      } finally {
        liveInFlightRef.current = false;
        if (!cancelled) liveTimerRef.current = setTimeout(sendFrame, 650);
      }
    };
    liveTimerRef.current = setTimeout(sendFrame, 300);
    return () => {
      cancelled = true;
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
      liveTimerRef.current = null;
    };
  }, [liveActive, apiRequest, sessionId]);

  useEffect(() => () => {
    if (liveStreamRef.current) liveStreamRef.current.getTracks().forEach((track) => track.stop());
    if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach((track) => track.stop());
    if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError("");

    const get = async (path) => {
      const base = apiBase.replace(/\/+$/, "");
      const response = await fetch(`${base}${path}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : `Request failed (${response.status})`
        );
      }

      return data;
    };

    try {
      const today = localDateString();
      const [summaryData, studentData, sessionData, subjectData, todaySummaryData, todayAttendanceData] = await Promise.all([
        get(`/attendance/statistics/summary${date ? `?session_date=${encodeURIComponent(date)}` : ""}`),
        get("/students"),
        get("/class-sessions"),
        get("/subjects"),
        get(`/attendance/statistics/summary?session_date=${encodeURIComponent(today)}`),
        get(`/attendance?session_date=${encodeURIComponent(today)}`),
      ]);
      const sessionItems = Array.isArray(sessionData) ? sessionData : sessionData.items || sessionData.sessions || [];
      const subjectItems = Array.isArray(subjectData) ? subjectData : subjectData.items || subjectData.subjects || [];
      const todayRecordItems = Array.isArray(todayAttendanceData)
        ? todayAttendanceData
        : todayAttendanceData.records || todayAttendanceData.items || [];
      setSessions(sessionItems);
      setSubjects(subjectItems);
      setSummary(summaryData);
      setOverviewSummary(todaySummaryData);
      setOverviewRecords(todayRecordItems);
      setStudents(Array.isArray(studentData) ? studentData : studentData.items || studentData.students || []);

      const effectiveSessionId = sessionId || sessionIdentifier(sessionItems[0] || {});
      if (!sessionId && effectiveSessionId) setSessionId(effectiveSessionId);
      if (effectiveSessionId) {
        const [sessionStats, attendanceData] = await Promise.all([
          get(`/attendance/statistics/class-sessions/${encodeURIComponent(effectiveSessionId)}`),
          get(`/attendance/class-sessions/${encodeURIComponent(effectiveSessionId)}`),
        ]);
        setStats(sessionStats);
        setRecords(Array.isArray(attendanceData) ? attendanceData : attendanceData.records || attendanceData.items || []);
      } else {
        setStats(null);
        setRecords([]);
      }
    } catch (e) {
      setError(
        `${e.message}. Check that the FastAPI server is running and the API URL is correct.`
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiBase, sessionId, date]);

  const changeStudentStatus = useCallback(async (student) => {
    const isActive = student.is_active !== false;
    const action = isActive ? "deactivate" : "reactivate";
    const displayName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || student.enrollment_number;

    if (isActive && !window.confirm(`Deactivate ${displayName}? Their attendance history will be kept, but face recognition will ignore this student.`)) {
      return;
    }

    try {
      if (isActive) {
        await apiRequest(`/students/${encodeURIComponent(student.id)}`, {
          method: "DELETE",
        });
      } else {
        await apiRequest(`/students/${encodeURIComponent(student.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: true }),
        });
      }
      await load();
      window.alert(`${displayName} has been ${action}d successfully.`);
    } catch (e) {
      window.alert(`Could not ${action} student: ${e.message}`);
    }
  }, [apiRequest, load]);

  const permanentlyDeleteStudent = useCallback(async (student) => {
    const displayName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || student.enrollment_number;
    const confirmed = window.confirm(
      `PERMANENTLY DELETE ${displayName}?\n\nThis cannot be undone. Related face data and attendance records may also be deleted. If related records prevent deletion, the server will keep the student and show an error. Choose Cancel to keep the student and use Deactivate instead.`
    );
    if (!confirmed) return;

    try {
      await apiRequest(`/students/${encodeURIComponent(student.id)}/permanent`, {
        method: "DELETE",
      });
      await load();
      window.alert(`${displayName} was permanently deleted.`);
    } catch (e) {
      window.alert(`Could not permanently delete ${displayName}: ${e.message}`);
    }
  }, [apiRequest, load]);

  useEffect(() => {
    load();
  }, [load]);

  const stopLiveAttendance = useCallback(async () => {
    setLiveActive(false);
    if (liveTimerRef.current) {
      clearTimeout(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((track) => track.stop());
      liveStreamRef.current = null;
    }
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
    try {
      await apiRequest("/live-attendance/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_session_id: sessionId }),
      });
      setLiveMessage("Attendance stopped. Saved records are being refreshed.");
      await load();
    } catch (e) {
      setLiveError(e.message || "Camera stopped, but the backend could not confirm the stop request.");
    }
  }, [apiRequest, sessionId, load]);

  const markDetectedStudent = useCallback(async (item, status) => {
    if (!item?.student_id || !item.stable || !item.saved || !sessionId) return;
    const key = `${item.student_id}:${status}`;
    setSavingDetectionId(key);
    setLiveError("");
    try {
      // Recognition already created the attendance record. This call only
      // applies the administrator's final Present/Late status to that record.
      const result = await apiRequest("/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_session_id: sessionId,
          student_id: item.student_id,
          status,
        }),
      });
      setLiveDetections((current) => current.map((detection) =>
        detection.student_id === item.student_id
          ? { ...detection, saved: true, status: result.status || status, message: result.message }
          : detection
      ));
      setLiveMessage(result.message || `Attendance for ${item.student_name} is now ${status.toUpperCase()}.`);
      await load();
    } catch (e) {
      setLiveError(e.message || "Could not update attendance status. Please try again.");
    } finally {
      setSavingDetectionId("");
    }
  }, [apiRequest, sessionId, load]);

  const saveAttendanceStatus = useCallback(async (student) => {
    const selectedStatus = manualStatuses[student.id];
    if (!selectedStatus) {
      setAttendanceAdminError("Choose a status before saving.");
      setAttendanceAdminMessage("");
      return;
    }
    if (!sessionId) {
      setAttendanceAdminError("Select a class session first.");
      setAttendanceAdminMessage("");
      return;
    }
    setSavingStudentId(student.id);
    setAttendanceAdminError("");
    setAttendanceAdminMessage("");
    try {
      await apiRequest("/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.id,
          class_session_id: sessionId,
          status: selectedStatus,
        }),
      });
      setAttendanceAdminMessage(`Saved ${selectedStatus.toUpperCase()} for ${`${student.first_name || ""} ${student.last_name || ""}`.trim() || student.enrollment_number}.`);
      setManualStatuses((current) => {
        const next = { ...current };
        delete next[student.id];
        return next;
      });
      await load();
    } catch (e) {
      setAttendanceAdminError(e.message || "Could not save attendance status.");
    } finally {
      setSavingStudentId("");
    }
  }, [manualStatuses, sessionId, apiRequest, load]);

  const changeExistingAttendanceStatus = useCallback(async (record, nextStatus) => {
    if (!nextStatus || nextStatus === record.status) return;
    setAttendanceAdminError("");
    setAttendanceAdminMessage("");
    try {
      await apiRequest(`/attendance/${encodeURIComponent(record.attendance_id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      setAttendanceAdminMessage(`Updated ${record.student_name || "student"} to ${nextStatus.toUpperCase()}.`);
      await load();
    } catch (e) {
      setAttendanceAdminError(e.message || "Could not update attendance status.");
    }
  }, [apiRequest, load]);

  const attendanceRecordByStudent = useMemo(() => {
    const byStudent = new Map();
    records.forEach((record) => byStudent.set(record.student_id, record));
    return byStudent;
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((record) => {
      const searchText = [
        record.student_name,
        record.enrollment_number,
        record.status,
        record.subject_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchText.includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "All" ||
        String(record.status || "").toLowerCase() ===
          statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [records, search, statusFilter]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students.filter((student) => {
      const name = `${student.first_name || ""} ${
        student.last_name || ""
      }`.trim();

      const searchableText = [
        name,
        student.enrollment_number,
        student.email,
        student.roll_number,
        student.department,
        student.semester,
        student.section,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(query);
      const isActive = student.is_active !== false;
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" && isActive) ||
        (statusFilter === "Inactive" && !isActive);

      return matchesSearch && matchesStatus;
    });
  }, [students, search, statusFilter]);

  const present = Number(stats?.present_count || 0);
  const late = Number(stats?.late_count || 0);
  const absent = Number(stats?.absent_count || 0);
  const excused = Number(stats?.excused_count || 0);
  const totalRecords = Number(
    stats?.attendance_record_count ?? records.length
  );
  const attendedCount = present + late;
  const apiRoster = stats?.total_active_students_in_subject_cohort;
  const activeStudentCount = students.filter((student) => student.is_active !== false).length;
  // Some subjects have no department/semester configured, which makes the API
  // cohort query return zero even when students and attendance records exist.
  // In that case use the active student list; if it is unavailable/empty, use
  // recorded rows as the only honest denominator rather than displaying 0%.
  const roster = Number(apiRoster) > 0 ? Number(apiRoster) : activeStudentCount;
  const rateDenominator = roster > 0 ? roster : totalRecords;
  const rate = rateDenominator > 0
    ? Math.min(100, (attendedCount / rateDenominator) * 100)
    : 0;

  function exportCsv() {
    const rows = [
      [
        "Student",
        "Enrollment number",
        "Subject",
        "Date",
        "Check-in time",
        "Check-out time",
        "Recognition similarity",
        "Status",
      ],
      ...filtered.map((record) => [
        record.student_name,
        record.enrollment_number,
        record.subject_name,
        record.session_date || stats?.session_date || date,
        record.check_in_time,
        record.check_out_time,
        record.recognition_similarity,
        record.status,
      ]),
    ];

    downloadCsv(rows, `attendance-${date}.csv`);
  }

  async function exportClassSessionCsv(session) {
    const id = sessionIdentifier(session);
    if (!id) {
      window.alert("This class session does not have a valid session ID.");
      return;
    }

    setExportingSessionId(id);
    try {
      const [attendanceData, sessionStats] = await Promise.all([
        apiRequest(`/attendance/class-sessions/${encodeURIComponent(id)}`),
        apiRequest(`/attendance/statistics/class-sessions/${encodeURIComponent(id)}`),
      ]);
      const sessionRecords = Array.isArray(attendanceData)
        ? attendanceData
        : attendanceData.records || attendanceData.items || [];
      const subjectName = sessionSubjectName(session);
      const sessionDate = session.session_date || "";
      const safeName = `${subjectName}-${sessionDate}`
        .replace(/[^a-z0-9-]+/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "class-session";

      const rows = [
        ["CLASS SESSION EXPORT", ""],
        ["Subject", subjectName],
        ["Session date", sessionDate],
        ["Start time", session.start_time || ""],
        ["End time", session.end_time || ""],
        ["Room", session.room || ""],
        ["Faculty", session.faculty_name || ""],
        ["Class session ID", id],
        ["Total recorded attendance entries", sessionStats.attendance_record_count ?? sessionRecords.length],
        ["Present", sessionStats.present_count ?? 0],
        ["Late", sessionStats.late_count ?? 0],
        ["Absent", sessionStats.absent_count ?? 0],
        ["Excused", sessionStats.excused_count ?? 0],
        ["Attendance percentage", sessionStats.attendance_percentage ?? ""],
        ["Active students in subject cohort", sessionStats.total_active_students_in_subject_cohort ?? ""],
        [],
        [
          "Attendance ID",
          "Student ID",
          "Student name",
          "Enrollment number",
          "Class session ID",
          "Subject ID",
          "Subject",
          "Session date",
          "Status",
          "Check-in time",
          "Check-out time",
          "Recognition similarity",
          "Notes",
          "Created at",
        ],
        ...sessionRecords.map((record) => [
          record.attendance_id || record.id || "",
          record.student_id || "",
          record.student_name || "",
          record.enrollment_number || "",
          record.class_session_id || id,
          record.subject_id || session.subject_id || "",
          record.subject_name || subjectName,
          record.session_date || sessionDate,
          record.status || "",
          record.check_in_time || "",
          record.check_out_time || "",
          record.recognition_similarity ?? record.confidence ?? "",
          record.notes || "",
          record.created_at || "",
        ]),
      ];

      downloadCsv(rows, `attendance-${safeName}.csv`);
    } catch (e) {
      window.alert(`Could not export this class session: ${e.message}`);
    } finally {
      setExportingSessionId("");
    }
  }

  function exportStudentsCsv() {
    const rows = [
      [
        "Student ID",
        "First name",
        "Last name",
        "Enrollment number",
        "Email",
        "Roll number",
        "Department",
        "Semester",
        "Section",
        "Active",
        "Created at",
      ],
      ...filteredStudents.map((student) => [
        student.id,
        student.first_name,
        student.last_name,
        student.enrollment_number,
        student.email,
        student.roll_number,
        student.department,
        student.semester,
        student.section,
        student.is_active ? "Yes" : "No",
        student.created_at,
      ]),
    ];

    downloadCsv(rows, "students.csv");
  }

  function downloadCsv(rows, filename) {
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function resetRegistration() {
    setRegisterOpen(false);
    setRegistrationMode("upload");
    setRegistrationError("");
    setRegistrationMessage("");
    setFaceImage(null);
    setFacePreview("");
    setCameraActive(false);
    setStudentForm({
      first_name: "",
      last_name: "",
      enrollment_number: "",
      email: "",
      roll_number: "",
      department: "",
      semester: "",
      section: "",
    });
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
  }

  function chooseFaceImage(file) {
    if (!file) return;
    setRegistrationError("");
    if (!file.type.startsWith("image/")) {
      setRegistrationError("Please choose a valid image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setRegistrationError("Image must be 10 MB or smaller.");
      return;
    }
    setFaceImage(file);
    setFacePreview(URL.createObjectURL(file));
    setRegistrationMessage("");
  }

  async function startCamera() {
    setRegistrationError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setRegistrationError("Camera access is unavailable. Use localhost or HTTPS, or upload an image instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setRegistrationMode("camera");
      setCameraActive(true);
      setFacePreview("");
      setFaceImage(null);
      setRegistrationMessage("");
      window.setTimeout(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setRegistrationError("Camera permission was denied or the camera is already in use. You can upload an image instead.");
    }
  }

  function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setCameraActive(false);
  }

  function captureCameraPhoto() {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setRegistrationError("The camera is not ready yet. Please wait a moment and try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setRegistrationError("Could not capture the photo. Please try again.");
        return;
      }
      const file = new File([blob], "student-face.jpg", { type: "image/jpeg" });
      setFaceImage(file);
      setFacePreview(URL.createObjectURL(file));
      setRegistrationError("");
      setRegistrationMessage("Photo captured. Review it before registering.");
      stopCamera();
    }, "image/jpeg", 0.92);
  }

  async function registerStudent(event) {
    event.preventDefault();
    setRegistrationError("");
    setRegistrationMessage("");

    if (!studentForm.first_name.trim() || !studentForm.enrollment_number.trim()) {
      setRegistrationError("First name and enrollment number are required.");
      return;
    }
    if (!faceImage) {
      setRegistrationError("Please upload a face image or capture one with the camera.");
      return;
    }

    setRegistrationBusy(true);
    let createdStudent = null;
    try {
      const base = apiBase.replace(/\/+$/, "");
      const studentPayload = {
        first_name: studentForm.first_name.trim(),
        last_name: studentForm.last_name.trim() || null,
        enrollment_number: studentForm.enrollment_number.trim(),
        email: studentForm.email.trim() || null,
        roll_number: studentForm.roll_number.trim() || null,
        department: studentForm.department.trim() || null,
        semester: studentForm.semester ? Number(studentForm.semester) : null,
        section: studentForm.section.trim() || null,
      };

      const studentResponse = await fetch(`${base}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentPayload),
      });
      const studentData = await studentResponse.json().catch(() => ({}));
      if (!studentResponse.ok) {
        const detail = studentData.detail;
        throw new Error(
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((item) => item.msg).join("; ")
              : `Student registration failed (${studentResponse.status}).`
        );
      }
      createdStudent = studentData.student || studentData;
      const studentId = createdStudent.id || createdStudent.student_id;
      if (!studentId) {
        throw new Error("The student was created, but the API response did not include a student ID. Face enrollment could not be submitted.");
      }

      const imageForm = new FormData();
      imageForm.append("image", faceImage);
      imageForm.append("student_id", studentId);

      // This request expects the face-enrollment API to accept a multipart image.
      const faceResponse = await fetch(`${base}/face-enrollment/${encodeURIComponent(studentId)}`, {
        method: "POST",
        body: imageForm,
      });
      const faceData = await faceResponse.json().catch(() => ({}));
      if (!faceResponse.ok) {
        const detail = faceData.detail;
        const reason = typeof detail === "string"
          ? detail
          : `Face enrollment endpoint returned ${faceResponse.status}.`;
        setRegistrationMessage(
          `Student ${createdStudent.enrollment_number || studentForm.enrollment_number} was created, but face enrollment did not complete: ${reason} Check the face-enrollment endpoint contract in Swagger.`
        );
        await load();
        return;
      }

      setRegistrationMessage("Student and face enrollment completed successfully.");
      await load();
      window.setTimeout(() => resetRegistration(), 900);
    } catch (e) {
      setRegistrationError(e.message || "Registration failed.");
      if (createdStudent) await load();
    } finally {
      setRegistrationBusy(false);
    }
  }

  const nav = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Attendance", icon: CheckCircle2 },
    { name: "Students", icon: Users },
    { name: "Subjects", icon: BookOpen },
    { name: "Class sessions", icon: CalendarDays },
    { name: "Settings", icon: Settings },
  ];

  const statusClass = (status) =>
    `status status-${String(status || "unknown").toLowerCase()}`;

  const initials = (name) =>
    (name || "?")
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  const time = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
  };

  const displayDate = (value) => {
    if (!value) return "—";
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };

  const studentName = (student) =>
    `${student.first_name || ""} ${student.last_name || ""}`.trim() ||
    "Unnamed student";

  const sessionSubjectName = (session) =>
    session.subject_name ||
    session.subject?.name ||
    session.subject?.subject_name ||
    session.subject?.title ||
    session.subject_code ||
    "Class session";

  const sessionIdentifier = (session) =>
    session.id || session.class_session_id || session.session_id || "";

  const activeStudents = students.filter(
    (student) => student.is_active !== false
  ).length;
  const inactiveStudents = students.length - activeStudents;

  return (
    <>
      <style>{`
      .modal-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto}
      .registration-modal{width:min(1080px,100%);max-height:calc(100vh - 48px);overflow:auto;background:#fff;border-radius:20px;padding:26px;box-shadow:0 24px 80px rgba(15,23,42,.28);color:#172033}
      .registration-modal-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:22px}
      .registration-modal-header h2{font-size:26px;margin:7px 0}
      .registration-modal-header p,.registration-hint{color:#64748b;font-size:13px;line-height:1.5}
      .registration-modal-header p{margin:0}
      .registration-modal h3{font-size:16px;margin:0 0 8px}
      .registration-layout{display:grid;grid-template-columns:minmax(260px,.85fr) minmax(380px,1.15fr);gap:22px}
      .face-capture-panel,.student-form-panel{border:1px solid #e2e8f0;border-radius:14px;padding:18px;min-width:0}
      .registration-hint{display:block}
      .face-empty-state{margin:16px 0;padding:24px 14px;border:1px dashed #cbd5e1;border-radius:12px;display:flex;align-items:center;gap:10px;flex-direction:column;text-align:center;background:#f8fafc}
      .face-placeholder{width:78px;height:78px;border-radius:50%;display:grid;place-items:center;background:#e8edff;color:#5969ee}
      .face-empty-state>span{font-size:12px;color:#64748b}
      .capture-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;margin-top:10px}
      .upload-label{display:inline-flex;align-items:center;gap:7px;cursor:pointer}
      .face-image-preview{margin-top:14px;display:flex;flex-direction:column;align-items:center;gap:10px}
      .face-image-preview img{width:100%;max-height:290px;object-fit:contain;background:#f1f5f9;border-radius:12px}
      .image-ready{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#16835f}
      .camera-preview{margin-top:14px}
      .camera-preview video{width:100%;max-height:290px;object-fit:cover;background:#0f172a;border-radius:12px}
      .camera-controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .registration-fields{display:grid;grid-template-columns:1fr 1fr;gap:13px}
      .registration-fields label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:#475569}
      .registration-fields label span{color:#dc2626;display:inline}
      .registration-fields input{width:100%;min-width:0;padding:10px 11px;border:1px solid #dbe2ea;border-radius:9px;background:#fff;color:#172033;font:inherit;font-size:13px;box-sizing:border-box}
      .registration-fields input:focus{outline:2px solid #c7d2fe;border-color:#818cf8}
      .field-wide{grid-column:1/-1}
      .registration-note{margin-top:18px;padding:12px;border-radius:10px;background:#f1f5ff;color:#4654a5;display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:1.5}
      .registration-note svg{flex-shrink:0}
      .registration-modal-footer{display:flex;justify-content:space-between;align-items:center;gap:16px;border-top:1px solid #e2e8f0;margin-top:22px;padding-top:18px}
      .registration-modal-footer>div{display:flex;gap:9px}
      .icon-button{padding:8px!important}
      .registration-alert{margin-bottom:14px}
      .registration-success{display:flex;gap:8px;align-items:flex-start;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;padding:11px 13px;border-radius:10px;margin-bottom:14px;font-size:13px}
      .filter-select{padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;color:#334155}
      .student-email{display:inline-flex;align-items:center;gap:5px}
      .inline-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#16a34a;margin-right:5px}
      .session-actions{display:flex;flex-wrap:wrap;gap:7px}

      /* Accessible theme layer: intentionally scoped so existing page behavior stays unchanged. */
      .shell{font-size:15px;line-height:1.55;transition:background-color .2s ease,color .2s ease}
      .shell button,.shell input,.shell select,.shell textarea{font:inherit}
      .shell button{transition:transform .15s ease,box-shadow .15s ease,background-color .2s ease,border-color .2s ease}
      .shell button:not(:disabled):hover{filter:brightness(1.04)}
      .shell button:focus-visible,.shell input:focus-visible,.shell select:focus-visible,.shell textarea:focus-visible{outline:3px solid #60a5fa;outline-offset:2px}
      .theme-toggle{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:9px 13px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--text);font-weight:750;cursor:pointer;white-space:nowrap}
      .theme-toggle svg{flex-shrink:0}
      .shell.theme-dark{--bg:#0b1220;--surface:#111c2e;--surface-2:#172338;--text:#f1f5f9;--muted:#bdc9da;--line:#33445d;--soft:#1b2a40;--field:#0d1727;--accent:#8da5ff;--shadow:0 12px 30px rgba(0,0,0,.22);background:var(--bg);color:var(--text);color-scheme:dark}
      .shell.theme-light{--bg:#f4f7fb;--surface:#ffffff;--surface-2:#f8fafc;--text:#172033;--muted:#526176;--line:#d7e0ec;--soft:#edf3fb;--field:#ffffff;--accent:#334fe0;--shadow:0 10px 28px rgba(20,42,80,.07);background:var(--bg);color:var(--text);color-scheme:light}
      .shell.theme-dark .sidebar,.shell.theme-dark .topbar,.shell.theme-dark .panel,.shell.theme-dark .metric,.shell.theme-dark .card,.shell.theme-dark .chart-card,.shell.theme-dark .table-wrap,.shell.theme-dark .welcome,.shell.theme-dark .help-card,.shell.theme-dark .settings,.shell.theme-dark .empty-state,.shell.theme-dark .session-card,.shell.theme-dark .subject-card{background:var(--surface)!important;color:var(--text)!important;border-color:var(--line)!important;box-shadow:var(--shadow)}
      .shell.theme-light .sidebar,.shell.theme-light .topbar,.shell.theme-light .panel,.shell.theme-light .metric,.shell.theme-light .card,.shell.theme-light .chart-card,.shell.theme-light .table-wrap,.shell.theme-light .welcome,.shell.theme-light .help-card,.shell.theme-light .settings,.shell.theme-light .empty-state,.shell.theme-light .session-card,.shell.theme-light .subject-card{background:var(--surface)!important;color:var(--text)!important;border-color:var(--line)!important}
      .shell.theme-dark h1,.shell.theme-dark h2,.shell.theme-dark h3,.shell.theme-dark h4,.shell.theme-dark b,.shell.theme-dark strong,.shell.theme-dark th,.shell.theme-dark .crumb,.shell.theme-dark .nav-item,.shell.theme-dark .brand b,.shell.theme-dark label{color:var(--text)}
      .shell.theme-light h1,.shell.theme-light h2,.shell.theme-light h3,.shell.theme-light h4,.shell.theme-light b,.shell.theme-light strong,.shell.theme-light th,.shell.theme-light .crumb,.shell.theme-light .nav-item,.shell.theme-light .brand b,.shell.theme-light label{color:var(--text)}
      .shell.theme-dark p,.shell.theme-dark small,.shell.theme-dark .nav-caption,.shell.theme-dark .crumb span,.shell.theme-dark .welcome p,.shell.theme-dark .metric p,.shell.theme-dark .metric small,.shell.theme-dark .registration-hint{color:var(--muted)}
      .shell.theme-light p,.shell.theme-light small,.shell.theme-light .nav-caption,.shell.theme-light .crumb span,.shell.theme-light .welcome p,.shell.theme-light .metric p,.shell.theme-light .metric small,.shell.theme-light .registration-hint{color:var(--muted)}
      .shell.theme-dark input:not([type=checkbox]):not([type=radio]),.shell.theme-dark select,.shell.theme-dark textarea,.shell.theme-dark .filter-select,.shell.theme-dark .date{background:var(--field)!important;color:var(--text)!important;border-color:var(--line)!important}
      .shell.theme-light input:not([type=checkbox]):not([type=radio]),.shell.theme-light select,.shell.theme-light textarea,.shell.theme-light .filter-select,.shell.theme-light .date{background:var(--field)!important;color:var(--text)!important;border-color:var(--line)!important}
      .shell.theme-dark table,.shell.theme-light table{color:var(--text)}
      .shell.theme-dark th,.shell.theme-dark td{border-color:var(--line)!important}
      .shell.theme-light th,.shell.theme-light td{border-color:var(--line)!important}
      .shell.theme-dark tr:hover td{background:#1a2940!important}
      .shell.theme-light tr:hover td{background:#f0f5ff!important}
      .shell.theme-dark .nav-item.active{background:#263b60!important;color:#ffffff!important}
      .shell.theme-light .nav-item.active{background:#e7edff!important;color:#233cc7!important}
      .shell.theme-dark .registration-modal{background:#111c2e!important;color:#f1f5f9!important;border:1px solid #33445d}
      .shell.theme-dark .registration-modal p,.shell.theme-dark .registration-modal label,.shell.theme-dark .registration-modal h2,.shell.theme-dark .registration-modal h3{color:#f1f5f9}
      .shell.theme-dark .face-capture-panel,.shell.theme-dark .student-form-panel{background:#172338;border-color:#33445d}
      .shell.theme-dark .face-empty-state{background:#0d1727;border-color:#42536c}
      .shell.theme-dark .registration-fields input{background:#0d1727;color:#f1f5f9;border-color:#42536c}
      .shell.theme-dark .registration-note{background:#202e4b;color:#cbd5ff}
      /* Dark-mode contrast fixes for legacy inline styles across every page. */
      .shell.theme-dark [style*="color: #172033"],.shell.theme-dark [style*="color:#172033"],
      .shell.theme-dark [style*="color: #334155"],.shell.theme-dark [style*="color:#334155"],
      .shell.theme-dark [style*="color: #475569"],.shell.theme-dark [style*="color:#475569"],
      .shell.theme-dark [style*="color: #64748b"],.shell.theme-dark [style*="color:#64748b"],
      .shell.theme-dark [style*="color: #526176"],.shell.theme-dark [style*="color:#526176"],
      .shell.theme-dark [style*="color: #0f172a"],.shell.theme-dark [style*="color:#0f172a"]{color:var(--text)!important}
      .shell.theme-dark [style*="background: white"],.shell.theme-dark [style*="background:white"],
      .shell.theme-dark [style*="background: #fff"],.shell.theme-dark [style*="background:#fff"],
      .shell.theme-dark [style*="background: #ffffff"],.shell.theme-dark [style*="background:#ffffff"],
      .shell.theme-dark [style*="background: #f8fafc"],.shell.theme-dark [style*="background:#f8fafc"],
      .shell.theme-dark [style*="background: #f1f5f9"],.shell.theme-dark [style*="background:#f1f5f9"]{background:var(--surface-2)!important}
      .shell.theme-dark [style*="border: 1px solid #e2e8f0"],.shell.theme-dark [style*="border:1px solid #e2e8f0"],
      .shell.theme-dark [style*="border: 1px solid #d7deea"],.shell.theme-dark [style*="border:1px solid #d7deea"]{border-color:var(--line)!important}
      .shell.theme-dark .filter-select,.shell.theme-dark select{background-color:var(--field)!important;color:var(--text)!important}
      .shell.theme-dark option{background:#111c2e!important;color:#f1f5f9!important}
      .shell.theme-dark .records td,.shell.theme-dark .records th,.shell.theme-dark .student small,.shell.theme-dark .student-email{color:var(--text)}
      .shell.theme-dark .records td small,.shell.theme-dark .student small{color:var(--muted)!important}
      .shell.theme-dark .registration-success{background:#12352c!important;color:#a7f3d0!important;border-color:#23634f!important}
      .shell.theme-dark .registration-alert{color:#fecaca!important}
      /* Targeted fixes confirmed from the dashboard screenshot: legacy light surfaces were retaining white text in dark mode. */
      .shell.theme-dark .subject,
      .shell.theme-dark .subject-card,
      .shell.theme-dark .session .subject,
      .shell.theme-dark .records .subject{background:var(--surface-2)!important;color:var(--text)!important;border-color:var(--line)!important}
      .shell.theme-dark .subject b,.shell.theme-dark .subject strong,.shell.theme-dark .subject section,
      .shell.theme-dark .subject small,.shell.theme-dark .subject p{color:var(--text)!important}
      .shell.theme-dark .subject small{color:var(--muted)!important}
      .shell.theme-dark .records thead,
      .shell.theme-dark .records thead tr,
      .shell.theme-dark .records thead th,
      .shell.theme-dark .table-wrap thead,
      .shell.theme-dark .table-wrap thead tr,
      .shell.theme-dark .table-wrap thead th{background:var(--surface-2)!important;color:var(--text)!important;border-color:var(--line)!important}
      .shell.theme-dark .records th,.shell.theme-dark .table-wrap th{color:var(--text)!important}
      .shell.theme-dark .records td,.shell.theme-dark .table-wrap td{color:var(--text)!important}
      .shell.theme-dark .records td small,.shell.theme-dark .table-wrap td small{color:var(--muted)!important}
      .shell.theme-dark .records .student b,.shell.theme-dark .records .student strong{color:var(--text)!important}
      .shell.theme-dark .session-numbers>div{background:var(--surface)!important;color:var(--text)!important;border-color:var(--line)!important}
      .shell.theme-dark .session-numbers small{color:var(--muted)!important}
      .shell.theme-dark .session-numbers b{color:var(--text)!important}
      .shell.theme-dark .records .empty{color:var(--muted)!important}
      .shell.theme-dark .panel-head p,.shell.theme-dark .records-head p{color:var(--muted)!important}
      .shell.theme-dark .subject svg{color:var(--accent)!important}
      .shell .metric strong{font-size:clamp(25px,2.2vw,32px);font-weight:850;letter-spacing:-.03em}
      .shell .metric p,.shell .panel h2,.shell .welcome h1{font-weight:800}
      .shell .metric p{font-size:14px}
      .shell .welcome h1{font-size:clamp(27px,3vw,36px);line-height:1.2;letter-spacing:-.035em}
      .shell .nav-item{font-weight:650;min-height:44px}
      .shell .panel,.shell .metric,.shell .table-wrap{border-radius:16px}
      @media(max-width:800px){.theme-toggle .theme-label{display:none}.theme-toggle{width:42px;padding:9px}}
      @media(max-width:800px){.modal-backdrop{padding:10px}.registration-modal{padding:17px;max-height:calc(100vh - 20px)}.registration-layout{grid-template-columns:1fr}.registration-modal-footer{align-items:flex-start;flex-direction:column}.registration-modal-footer>div{width:100%;justify-content:flex-end}}
      @media(max-width:480px){.registration-fields{grid-template-columns:1fr}.field-wide{grid-column:auto}.capture-actions,.camera-controls{flex-direction:column;align-items:stretch}.registration-modal-footer>div{flex-direction:column}.registration-modal-footer button{width:100%}}

      /* Visual refresh: stronger contrast, richer accents, and clearer interaction states. */
      .shell{font-size:15px;line-height:1.6;background-image:radial-gradient(ellipse at 80% 0%,rgba(79,105,255,.08),transparent 34%)}
      .shell.theme-dark{--bg:#080f1d;--surface:#111d31;--surface-2:#192943;--text:#f8fafc;--muted:#c3d0e2;--line:#3a4d69;--soft:#1e3150;--field:#0b1526;--accent:#9db1ff;--shadow:0 14px 36px rgba(0,0,0,.26)}
      .shell.theme-light{--bg:#f3f6fc;--surface:#fff;--surface-2:#f7f9ff;--text:#14213a;--muted:#52627a;--line:#d3deee;--soft:#eaf0ff;--field:#fff;--accent:#3456e8;--shadow:0 12px 32px rgba(35,58,105,.09)}
      .shell.theme-dark .sidebar{background:linear-gradient(180deg,#101c30 0%,#0d1728 100%)!important}
      .shell.theme-light .sidebar{background:linear-gradient(180deg,#fff 0%,#f5f8ff 100%)!important}
      .shell .brand-logo{box-shadow:0 8px 22px rgba(79,95,240,.28);border-radius:15px}
      .shell .brand b{font-size:17px;letter-spacing:-.025em}
      .shell .nav-item{font-size:14px;font-weight:750;min-height:47px;border-radius:12px;transition:background .18s ease,transform .18s ease}
      .shell .nav-item:hover{transform:translateX(2px)}
      .shell.theme-dark .nav-item.active{background:linear-gradient(100deg,#2b4775,#26365b)!important;color:#fff!important;box-shadow:inset 3px 0 #91a7ff,0 5px 15px rgba(0,0,0,.12)}
      .shell.theme-light .nav-item.active{background:linear-gradient(100deg,#e5ebff,#f1f4ff)!important;color:#213fca!important;box-shadow:inset 3px 0 #435df0}
      .shell .metric,.shell .panel,.shell .table-wrap,.shell .session-card,.shell .subject-card,.shell .chart-card,.shell .welcome{border-radius:18px;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
      .shell .donut>div{background:#fff!important;color:#14213a!important;border-radius:50%;width:74%;height:74%;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box}
      .shell .donut>div b{color:#14213a!important;font-size:clamp(24px,2.4vw,34px)!important;font-weight:900!important;line-height:1.1!important;opacity:1!important;text-shadow:none!important}
      .shell .donut>div span{color:#52627a!important;font-size:11px!important;font-weight:700!important;margin-top:5px}
      .shell .metric{position:relative;overflow:hidden;border:1px solid var(--line)!important}
      .shell .metric:after{content:"";position:absolute;width:92px;height:92px;right:-32px;top:-38px;border-radius:50%;background:var(--metric-glow,rgba(91,112,255,.12));pointer-events:none}
      .shell .metric:nth-child(4n+1){--metric-glow:rgba(56,189,248,.16)}
      .shell .metric:nth-child(4n+2){--metric-glow:rgba(52,211,153,.16)}
      .shell .metric:nth-child(4n+3){--metric-glow:rgba(251,191,36,.16)}
      .shell .metric:nth-child(4n){--metric-glow:rgba(167,139,250,.18)}
      .shell .metric-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:var(--soft);color:var(--accent);border:1px solid var(--line)}
      .shell .metric:hover,.shell .panel:hover,.shell .session-card:hover,.shell .subject-card:hover{border-color:var(--accent)!important;box-shadow:var(--shadow);transform:translateY(-2px)}
      .shell .metric p{font-size:14px;font-weight:750;letter-spacing:.005em}
      .shell .metric strong{font-size:clamp(27px,2.4vw,35px);font-weight:900;letter-spacing:-.04em;line-height:1.2}
      .shell .panel h2,.shell .panel-head h2,.shell .records-head h2{font-size:17px;font-weight:850;letter-spacing:-.02em}
      .shell .panel p,.shell .panel small,.shell .metric small{font-size:13px}
      .shell .table-wrap{overflow:hidden;border:1px solid var(--line)!important}
      .shell .live-recognition-actions{display:flex;gap:7px;flex-wrap:wrap}
      @media (max-width: 900px){.shell .live-attendance-grid{grid-template-columns:minmax(0,1fr)!important}}
      @media (min-width: 901px){.shell .live-attendance-grid{align-items:start}}
      .shell table{border-collapse:separate;border-spacing:0;width:100%}
      .shell thead th{font-size:11px!important;font-weight:850!important;letter-spacing:.075em;text-transform:uppercase;padding:14px 16px!important;white-space:nowrap}
      .shell.theme-dark thead th{background:#20314d!important;color:#e8efff!important;border-bottom:1px solid #435777!important}
      .shell.theme-light thead th{background:#eaf0fb!important;color:#273a5a!important;border-bottom:1px solid #d3deee!important}
      .shell tbody td{font-size:13px;padding:13px 16px!important}
      .shell tbody tr:nth-child(even) td{background:rgba(125,150,190,.045)}
      .shell .theme-toggle{box-shadow:0 3px 12px rgba(20,35,65,.1);font-size:13px}
      .shell button:not(.nav-item):not(.close-menu):not(.icon-button){font-weight:750}
      .shell button:active{transform:translateY(1px)}
      .shell .status,.shell [class*="badge"]{font-weight:800;letter-spacing:.01em}
      .shell a{font-weight:650;text-underline-offset:3px}
      .shell input::placeholder,.shell textarea::placeholder{color:var(--muted)!important;opacity:.85}
      .shell .welcome{position:relative;overflow:hidden}
      .shell .welcome:after{content:"";position:absolute;right:-34px;top:-55px;width:190px;height:190px;border-radius:50%;border:1px solid rgba(125,145,255,.2);box-shadow:0 0 0 24px rgba(125,145,255,.045),0 0 0 48px rgba(125,145,255,.03);pointer-events:none}
      @media(max-width:800px){.shell .metric:hover,.shell .panel:hover,.shell .session-card:hover,.shell .subject-card:hover{transform:none}.shell tbody td{padding:11px 12px!important}}

      .shell.theme-light .overview-hero{background:linear-gradient(120deg,#172554 0%,#263f83 55%,#3157a4 100%)!important;color:#fff!important;border-color:#263f83!important}
      .shell.theme-light .overview-hero h2,.shell.theme-light .overview-hero strong{color:#fff!important}
      .shell.theme-light .overview-hero p,.shell.theme-light .overview-hero small{color:#e4ecff!important}
      .shell.theme-light .overview-hero .overview-date{background:rgba(255,255,255,.14)!important;color:#fff!important}

      /* Sidebar navigation: maintain readable contrast in either theme. */
      .shell .sidebar{position:fixed!important;top:0!important;bottom:0!important;left:0!important;z-index:30!important;overflow-y:auto!important;overscroll-behavior:contain}
      .shell .main{min-width:0}
      .shell .nav-caption{color:var(--muted)!important}
      .shell .nav-item{color:var(--muted)!important;border:1px solid transparent!important;transition:background .16s ease,color .16s ease,border-color .16s ease}
      .shell .nav-item:hover{background:var(--soft)!important;color:var(--text)!important;border-color:var(--line)!important}
      .shell .nav-item.active{background:var(--soft)!important;color:var(--accent)!important;border-color:var(--accent)!important;box-shadow:inset 3px 0 0 var(--accent)!important;font-weight:850!important}
      .shell .nav-item.active svg{color:var(--accent)!important;stroke-width:2.5}
      .shell.theme-dark .nav-item.active{background:#263c61!important;color:#ffffff!important;border-color:#829cff!important}
      .shell.theme-dark .nav-item.active svg{color:#ffffff!important}
      .shell.theme-light .nav-item.active{background:#e4ebff!important;color:#173cc5!important;border-color:#8299ff!important}
      .shell.theme-light .nav-item.active svg{color:#173cc5!important}
      .shell .nav-item i{background:currentColor!important;opacity:.95}
      .shell.theme-dark .sidebar{border-right:1px solid #344661!important}
      .shell.theme-light .sidebar{border-right:1px solid #d3deee!important}
      .shell .brand b,.shell .user b{color:var(--text)!important}
      .shell .brand small,.shell .user small{color:var(--muted)!important}
      .shell .help-card{background:var(--surface-2)!important;border-color:var(--line)!important;color:var(--text)!important}
      .shell .help-card p{color:var(--muted)!important}
      .shell .user{border-top-color:var(--line)!important}
      @media(max-width:650px){.shell .sidebar{height:100dvh!important;overflow-y:auto!important}.shell .sidebar.open{z-index:50!important}.shell .scrim{z-index:40!important}}
    `}
</style>
    <div className={`shell theme-${theme}`}>
      {menuOpen && (
        <button
          className="scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-logo">
            <ShieldCheck size={23} />
          </div>
          <div>
            <b>
              FaceAttendance<span>AI</span>
            </b>
            <small>SMART CAMPUS</small>
          </div>
          <button
            className="close-menu"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="nav-caption">WORKSPACE</div>
        {nav.map((item) => (
          <button
            key={item.name}
            className={`nav-item ${page === item.name ? "active" : ""}`}
            onClick={() => {
              setPage(item.name);
              setSearch("");
              setStatusFilter("All");
              setMenuOpen(false);
            }}
          >
            <item.icon size={18} />
            {item.name}
            {item.name === "Attendance" && <i />}
          </button>
        ))}

        <div className="side-spacer" />

        <div className="help-card">
          <div className="help-icon">?</div>
          <b>Need a hand?</b>
          <p>Check your API connection or refresh campus data.</p>
          <button onClick={() => setPage("Settings")}>
            Connection settings →
          </button>
        </div>

        <div className="user">
          <div className="user-avatar">FA</div>
          <div>
            <b>Administrator</b>
            <small>Campus admin</small>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            className="hamburger"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>
          <div className="crumb">
            Workspace <span>/</span> <b>{page}</b>
          </div>
          <div className={`connection ${error ? "offline" : ""}`}>
            <i />
            {error
              ? "API disconnected"
              : loading
                ? "Connecting…"
                : "API connected"}
          </div>
          <button
            className="theme-toggle"
            onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            <span className="theme-label">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
          <button className="bell" aria-label="Notifications">
            <Bell size={18} />
          </button>
          <div className="admin-avatar">AD</div>
        </header>

        <div className="content">
          <section className="welcome">
            <div>
              <div className="eyebrow">
                —{" "}
                {page === "Attendance"
                  ? "ATTENDANCE MANAGEMENT"
                  : page === "Students"
                    ? "STUDENT MANAGEMENT"
                    : page === "Class sessions"
                      ? "SESSION MANAGEMENT"
                      : page === "Subjects"
                        ? "SUBJECT MANAGEMENT"
                        : "CAMPUS OVERVIEW"}
              </div>
              <h1>
                {page === "Overview" ? "Good afternoon, Admin" : page}
              </h1>
              <p>
                {page === "Attendance"
                  ? "Review, search, and export student attendance records."
                  : page === "Students"
                    ? "View student profiles and enrollment details."
                    : page === "Class sessions"
                      ? "Review class sessions by subject, date and time."
                      : page === "Subjects"
                        ? "Create, update and manage the subjects used by class sessions."
                        : "Here’s what’s happening with attendance across your campus."}
              </p>
            </div>

            <div className="actions">
              {page !== "Settings" && (
                <label className="date">
                  <CalendarDays size={16} />
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
              )}
              <button
                className="primary"
                onClick={load}
                disabled={refreshing}
              >
                <RefreshCw
                  size={15}
                  className={refreshing ? "spin" : ""}
                />
                Refresh data
              </button>
            </div>
          </section>

          {error && (
            <div className="error">
              <AlertCircle size={19} />
              <div>
                <b>Could not load dashboard data</b>
                <p>{error}</p>
                <small>API: {apiBase}</small>
              </div>
            </div>
          )}

          {page === "Settings" ? (
            <section className="panel settings">
              <h2>Connection settings</h2>
              <p>Configure the URL of your FastAPI backend.</p>
              <label>API base URL</label>
              <input
                value={apiBase}
                onChange={(event) => setApiBase(event.target.value)}
              />
              <small>Default: http://127.0.0.1:8000/api/v1</small>
              <button className="primary" onClick={load}>
                Save and reconnect
              </button>
            </section>
          ) : page === "Attendance" ? (
            <>
              <section className="panel" style={{ padding: 20, marginBottom: 20 }}>
                <div className="panel-head" style={{ marginBottom: 14 }}>
                  <div><h2>Attendance session</h2><p>Choose the exact class session before viewing or editing attendance.</p></div>
                  <span className="chip">{sessions.length} sessions</span>
                </div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 650, marginBottom: 7 }}>Subject · date · time</label>
                <select value={sessionId} onChange={(event) => setSessionId(event.target.value)} disabled={liveActive || liveBusy} style={{ width: "100%", maxWidth: 760, padding: "11px 12px", borderRadius: 10, border: "1px solid #d7deea", background: "white", color: "#172033" }}>
                  <option value="">Select a class session</option>
                  {sessions.map((session) => { const id = sessionIdentifier(session); return <option key={id} value={id}>{sessionSubjectName(session)} · {displayDate(session.session_date)} · {time(session.start_time)}–{time(session.end_time)}</option>; })}
                </select>
                {(() => { const chosen = sessions.find((item) => sessionIdentifier(item) === sessionId); return chosen ? <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12, color: "#475569", fontSize: 13 }}><span><b>Subject:</b> {sessionSubjectName(chosen)}</span><span><b>Date:</b> {displayDate(chosen.session_date)}</span><span><b>Time:</b> {time(chosen.start_time)}–{time(chosen.end_time)}</span>{chosen.room && <span><b>Room:</b> {chosen.room}</span>}{chosen.faculty_name && <span><b>Faculty:</b> {chosen.faculty_name}</span>}</div> : <p style={{ color: "#b42318", marginBottom: 0 }}>Select a session to load its attendance records.</p>; })()}
              </section>
              <section className="panel records" style={{ marginBottom: 20 }}>
                <div className="records-head">
                  <div>
                    <h2>Administrator attendance control</h2>
                    <p>Choose the status for any active student in the selected class session. No automatic late classification is applied.</p>
                  </div>
                  <button className="secondary" onClick={load} disabled={refreshing}>
                    <RefreshCw size={15} className={refreshing ? "spin" : ""} /> Refresh roster
                  </button>
                </div>
                {attendanceAdminError && <div className="error" role="alert"><AlertCircle size={17} /><span>{attendanceAdminError}</span></div>}
                {attendanceAdminMessage && <div className="success" role="status">{attendanceAdminMessage}</div>}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>STUDENT</th><th>ENROLLMENT NO.</th><th>CURRENT STATUS</th><th>ADMIN STATUS</th><th>ACTION</th></tr>
                    </thead>
                    <tbody>
                      {students.filter((student) => student.is_active !== false).length === 0 ? (
                        <tr><td colSpan="5" className="empty">No active students found.</td></tr>
                      ) : students.filter((student) => student.is_active !== false).map((student) => {
                        const record = attendanceRecordByStudent.get(student.id);
                        const selected = manualStatuses[student.id] ?? "";
                        return (
                          <tr key={`admin-${student.id}`}>
                            <td><div className="student"><StudentAvatar apiBase={apiBase} studentId={student.id} name={`${student.first_name || ""} ${student.last_name || ""}`} /><div><b>{`${student.first_name || ""} ${student.last_name || ""}`.trim() || "Unnamed student"}</b><small>{record ? "Recorded for this session" : "Not yet recorded"}</small></div></div></td>
                            <td className="mono">{student.enrollment_number || "—"}</td>
                            <td>{record ? <span className={statusClass(record.status)}>{record.status}</span> : <span className="muted">Not marked</span>}</td>
                            <td>
                              <select aria-label={`Select attendance status for ${student.enrollment_number}`} className="filter-select" value={selected} onChange={(event) => setManualStatuses((current) => ({ ...current, [student.id]: event.target.value }))} style={{ minWidth: 130 }}>
                                <option value="">Choose status</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="excused">Excused</option>
                              </select>
                            </td>
                            <td><button className="primary" disabled={!sessionId || !selected || savingStudentId === student.id} onClick={() => saveAttendanceStatus(student)}>{savingStudentId === student.id ? "Saving…" : "Save status"}</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="table-foot"><span>Selected session: <b>{sessions.find((item) => sessionIdentifier(item) === sessionId) ? `${sessionSubjectName(sessions.find((item) => sessionIdentifier(item) === sessionId))} · ${displayDate(sessions.find((item) => sessionIdentifier(item) === sessionId).session_date)}` : "None — select a session above"}</b></span><span>Saving a status creates or updates that student's attendance record.</span></div>
              </section>
              <section className="panel" style={{ padding: 20, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <ScanFace size={22} />
                      <h2 style={{ margin: 0 }}>Take live attendance</h2>
                    </div>
                    <p style={{ margin: "8px 0 14px", color: "var(--muted, #64748b)" }}>Select a class session and keep enrolled students in view. A stable face match is recorded automatically; then choose Present or Late to set the final status.</p>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Class session</label>
                    <select value={sessionId} disabled={liveActive || liveBusy} onChange={(event) => setSessionId(event.target.value)} style={{ minWidth: 280, maxWidth: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d7deea", background: "white" }}>
                      {sessions.length === 0 && <option value={sessionId}>{sessionId || "No class sessions found"}</option>}
                      {sessions.map((session) => {
                        const id = sessionIdentifier(session);
                        return <option key={id} value={id}>{sessionSubjectName(session)} · {session.session_date ? displayDate(session.session_date) : id}</option>;
                      })}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    {!liveActive ? (
                      <button className="primary" onClick={startLiveAttendance} disabled={liveBusy || !sessionId}>
                        {liveBusy ? <><RefreshCw size={15} className="spin" /> Starting…</> : <><Play size={15} /> Take Attendance</>}
                      </button>
                    ) : (
                      <button className="primary" onClick={stopLiveAttendance} style={{ background: "#b42318" }}>
                        <Square size={15} /> Stop Attendance
                      </button>
                    )}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: liveActive ? "#16803c" : "#64748b" }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: liveActive ? "#16a34a" : "#94a3b8", display: "inline-block" }} />{liveActive ? "Live" : "Stopped"}</span>
                  </div>
                </div>
                {liveError && <div role="alert" style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#fff1f0", color: "#b42318", fontSize: 13 }}>{liveError}</div>}
                <div className="live-attendance-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 14, marginTop: 14 }}>
                  <div style={{ background: "#0b1220", borderRadius: 14, overflow: "hidden", minHeight: 230, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                    <video ref={liveVideoRef} muted playsInline autoPlay style={{ display: liveActive ? "block" : "none", width: "100%", maxHeight: "min(52vh, 430px)", objectFit: "contain" }} />
                    {!liveActive && <div style={{ textAlign: "center", color: "#cbd5e1", padding: 30 }}><Video size={38} /><p style={{ marginBottom: 0 }}>Camera preview appears here when attendance starts.</p></div>}
                    <canvas ref={liveCanvasRef} style={{ display: "none" }} />
                    {liveActive && <span style={{ position: "absolute", top: 12, left: 12, background: "#b42318", color: "white", padding: "5px 9px", borderRadius: 7, fontSize: 11, fontWeight: 700 }}>LIVE CAMERA</span>}
                  </div>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><h3 style={{ margin: 0 }}>Recognition results</h3><span style={{ fontSize: 12, color: "#16803c", fontWeight: 700 }}>{liveSavedCount} saved</span></div>
                    <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{liveMessage}</p>
                    <div style={{ display: "grid", gap: 9, maxHeight: "none", overflowY: "visible" }}>
                      {liveDetections.length === 0 ? <div style={{ padding: 14, borderRadius: 10, background: "#f8fafc", color: "#64748b", fontSize: 13 }}>No face results yet. Face matching requires students to have completed face enrollment.</div> : liveDetections.map((item, index) => <div key={`${item.student_id || item.label || "face"}-${index}`} style={{ padding: 11, borderRadius: 10, background: item.saved ? "#f0fdf4" : item.recognized ? "#eff6ff" : "#fff7ed", border: `1px solid ${item.saved ? "#bbf7d0" : item.recognized ? "#bfdbfe" : "#fed7aa"}` }}><div style={{ fontWeight: 700, fontSize: 13 }}>{item.student_name || item.label || "Unknown face"}</div><div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{item.enrollment_number || (item.recognized ? "Recognized" : "Not matched")}{item.similarity != null ? ` · ${(Number(item.similarity) * 100).toFixed(1)}% match` : ""}</div><div style={{ fontSize: 11, fontWeight: 700, marginTop: 5, color: item.saved ? "#15803d" : item.stable ? "#1d4ed8" : item.recognized ? "#1d4ed8" : "#c2410c" }}>{item.saved ? `RECORDED — CURRENT STATUS: ${(item.status || "present").toUpperCase()}` : item.stable ? "MATCH CONFIRMED — SAVING RECORD…" : item.recognized ? "MATCHING FACE — WAITING FOR CONSISTENT MATCHES" : "UNKNOWN FACE"}</div>{item.stable && item.saved && item.student_id && <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}><button className="primary" disabled={Boolean(savingDetectionId)} onClick={() => markDetectedStudent(item, "present")}>{savingDetectionId === `${item.student_id}:present` ? "Updating…" : "Set Present"}</button><button className="secondary" disabled={Boolean(savingDetectionId)} onClick={() => markDetectedStudent(item, "late")}>{savingDetectionId === `${item.student_id}:late` ? "Updating…" : "Set Late"}</button><button className="secondary" disabled={Boolean(savingDetectionId)} onClick={() => markDetectedStudent(item, "absent")}>{savingDetectionId === `${item.student_id}:absent` ? "Updating…" : "Set Absent"}</button></div>}</div>)}
                    </div>
                  </div>
                </div>
                <p style={{ margin: "12px 0 0", fontSize: 12, color: "#64748b" }}>Keep the page open during attendance. Stable recognized faces are saved automatically as a provisional Present record. Use Set Present or Set Late to choose the final status. Duplicate records are prevented for each student/session.</p>
              </section>
              {(() => {
                const today = localDateString();
                const todaySessions = sessions
                  .filter((session) => session.session_date === today)
                  .sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || "")));
                const activeStudentCount = students.filter((student) => student.is_active !== false).length;
                const todayPresent = Number(overviewSummary?.present_count || 0);
                const todayLate = Number(overviewSummary?.late_count || 0);
                const todayAbsent = Number(overviewSummary?.absent_count || 0);
                const todayExcused = Number(overviewSummary?.excused_count || 0);
                const todayRecordCount = Number(overviewSummary?.total_attendance_records ?? overviewRecords.length);
                const markedOnTimeOrLate = todayPresent + todayLate;
                const markedRate = todayRecordCount > 0 ? Math.round((markedOnTimeOrLate / todayRecordCount) * 100) : 0;
                const recentToday = [...overviewRecords]
                  .sort((a, b) => String(b.check_in_time || b.created_at || "").localeCompare(String(a.check_in_time || a.created_at || "")))
                  .slice(0, 8);

                return (
                  <>
                    <section className="panel overview-hero" style={{ padding: 22, marginBottom: 20, background: "linear-gradient(120deg,#172554 0%,#263f83 55%,#3157a4 100%)", color: "#fff", border: 0 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                        <div>
                          <p style={{ margin: "0 0 8px", color: "#c7d7ff", fontSize: 12, fontWeight: 750, letterSpacing: ".1em", textTransform: "uppercase" }}>Administrator overview</p>
                          <h2 style={{ margin: "0 0 7px", fontSize: 26, color: "#fff" }}>Campus attendance at a glance</h2>
                          <p style={{ margin: 0, color: "#dbe7ff", fontSize: 13 }}>A live summary of today's classes, attendance activity, and student records.</p>
                        </div>
                        <div className="overview-date" style={{ padding: "10px 13px", borderRadius: 12, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", minWidth: 150 }}>
                          <small style={{ display: "block", color: "#c7d7ff", marginBottom: 4 }}>TODAY</small>
                          <strong style={{ color: "#fff", fontSize: 16 }}>{displayDate(today)}</strong>
                        </div>
                      </div>
                    </section>

                    <section className="metrics">
                      <Metric icon={Users} title="Active students" value={loading ? "—" : activeStudentCount} detail={`${students.length - activeStudentCount} inactive · ${students.length} total registered`} tone="blue" />
                      <Metric icon={BookOpen} title="Subjects" value={loading ? "—" : subjects.length} detail="Subjects configured in the system" tone="purple" />
                      <Metric icon={CalendarDays} title="Classes scheduled today" value={loading ? "—" : todaySessions.length} detail="Based on class-session dates" tone="amber" />
                      <Metric icon={CheckCircle2} title="Attendance entries today" value={loading ? "—" : todayRecordCount} detail={`${todayPresent} present · ${todayLate} late`} tone="green" />
                    </section>

                    <section className="middle" style={{ marginTop: 20 }}>
                      <article className="panel overview">
                        <div className="panel-head">
                          <div>
                            <h2>Today's attendance status</h2>
                            <p>Counts across all class sessions scheduled for {displayDate(today)}</p>
                          </div>
                          <span className="chip">{todayRecordCount} records</span>
                        </div>
                        <div className="chart-area">
                          <div className="donut" style={{ "--p": todayPresent, "--l": todayLate, "--a": todayAbsent, "--e": todayExcused, "--total": Math.max(todayRecordCount, 1) }}>
                            <div style={{ background: "#ffffff", color: "#14213a", borderRadius: "50%", width: "74%", height: "74%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}><b style={{ color: "#14213a", fontSize: "clamp(24px, 2.4vw, 34px)", fontWeight: 900, lineHeight: 1.1, opacity: 1 }}>{markedRate}%</b><span style={{ color: "#52627a", fontSize: 11, fontWeight: 700, marginTop: 5 }}>Present / Late</span></div>
                          </div>
                          <div className="legend">
                            <Legend color="green" label="Present" value={todayPresent} />
                            <Legend color="amber" label="Late" value={todayLate} />
                            <Legend color="gray" label="Absent" value={todayAbsent} />
                            <Legend color="purple" label="Excused" value={todayExcused} />
                            <small>{todayRecordCount ? "Percentage is calculated from today's recorded attendance entries, not the full class roster." : "No attendance entries have been recorded for today yet."}</small>
                          </div>
                        </div>
                        <div className="panel-foot">
                          <span><ShieldCheck size={15} /> Summary from today's database records</span>
                          <button onClick={() => setPage("Attendance")}>Manage attendance →</button>
                        </div>
                      </article>

                      <article className="panel session">
                        <div className="panel-head">
                          <div><h2>Today's classes</h2><p>Scheduled sessions with subject and time</p></div>
                          <span className="chip">{todaySessions.length} sessions</span>
                        </div>
                        {todaySessions.length === 0 ? (
                          <div style={{ padding: "28px 12px", textAlign: "center", color: "#64748b" }}>
                            <CalendarDays size={28} style={{ marginBottom: 8, opacity: .65 }} />
                            <p style={{ margin: "0 0 5px", fontWeight: 700, color: "#334155" }}>No classes scheduled today</p>
                            <small>Create a class session to see it listed here.</small>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 0 }}>
                            {todaySessions.slice(0, 5).map((session) => {
                              const id = sessionIdentifier(session);
                              const sessionRecordCount = overviewRecords.filter((record) => record.class_session_id === id).length;
                              return <div key={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 0", borderBottom: "1px solid #edf0f5" }}>
                                <div style={{ minWidth: 0 }}>
                                  <strong style={{ display: "block", color: "#172033", fontSize: 13 }}>{sessionSubjectName(session)}</strong>
                                  <small style={{ color: "#64748b" }}>{time(session.start_time)}–{time(session.end_time)}{session.room ? ` · ${session.room}` : ""}</small>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  <strong style={{ display: "block", fontSize: 13, color: "#334155" }}>{sessionRecordCount}</strong>
                                  <small style={{ color: "#64748b" }}>records</small>
                                  <button className="secondary" style={{ display: "block", marginTop: 5, padding: "5px 8px", fontSize: 11 }} onClick={() => { setSessionId(id); setPage("Attendance"); }}>View</button>
                                </div>
                              </div>;
                            })}
                          </div>
                        )}
                        {todaySessions.length > 5 && <div className="panel-foot"><span>Showing 5 of {todaySessions.length} sessions</span><button onClick={() => setPage("Class sessions")}>All class sessions →</button></div>}
                      </article>
                    </section>

                    <section className="panel records" style={{ marginTop: 20 }}>
                      <div className="records-head">
                        <div><h2>Recent attendance today</h2><p>Latest attendance entries across all of today's sessions</p></div>
                        <div className="record-actions">
                          <span className="chip">{recentToday.length} shown</span>
                          <button className="secondary" onClick={load} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "spin" : ""} /> Refresh overview</button>
                        </div>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>STUDENT</th><th>ENROLLMENT NO.</th><th>SUBJECT / SESSION DATE</th><th>CHECK-IN / RECORDED</th><th>STATUS</th></tr></thead>
                          <tbody>
                            {loading ? <tr><td colSpan="5" className="empty">Loading today's attendance…</td></tr> : recentToday.length === 0 ? <tr><td colSpan="5" className="empty">No attendance has been recorded today.</td></tr> : recentToday.map((record) => {
                              const recordedAt = record.check_in_time || record.created_at;
                              const session = sessions.find((item) => sessionIdentifier(item) === record.class_session_id);
                              return <tr key={record.attendance_id || `${record.student_id}-${record.class_session_id}`}>
                                <td><strong>{record.student_name || "Unknown student"}</strong></td>
                                <td>{record.enrollment_number || "—"}</td>
                                <td>{record.subject_name || (session ? sessionSubjectName(session) : "Unknown subject")}<br /><small>{displayDate(record.session_date || today)}</small></td>
                                <td>{recordedAt ? new Date(recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not recorded"}<br /><small>{record.created_at ? `Saved ${new Date(record.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Check-in time"}</small></td>
                                <td><span className={`status ${String(record.status || "").toLowerCase()}`}>{String(record.status || "Unknown").replace(/_/g, " ")}</span></td>
                              </tr>;
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="panel-foot"><span>Recent records are filtered by the class session date for today.</span><button onClick={() => setPage("Attendance")}>Open attendance →</button></div>
                    </section>
                  </>
                );
              })()}
            </>
          ) : page === "Students" ? (
            <>
              <section className="metrics">
                <Metric
                  icon={Users}
                  title="Total students"
                  value={loading ? "—" : students.length}
                  detail="Registered student profiles"
                  tone="blue"
                />
                <Metric
                  icon={CheckCircle2}
                  title="Active students"
                  value={loading ? "—" : activeStudents}
                  detail="Currently active"
                  tone="green"
                />
                <Metric
                  icon={UserRound}
                  title="Inactive students"
                  value={loading ? "—" : inactiveStudents}
                  detail="Not currently active"
                  tone="amber"
                />
                <Metric
                  icon={GraduationCap}
                  title="Departments"
                  value={
                    loading
                      ? "—"
                      : new Set(
                          students
                            .map((student) => student.department)
                            .filter(Boolean)
                        ).size
                  }
                  detail="Departments represented"
                  tone="purple"
                />
              </section>

              <section className="panel records">
                <div className="records-head">
                  <div>
                    <h2>Student directory</h2>
                    <p>
                      Student profiles retrieved from the database
                    </p>
                  </div>
                  <div className="record-actions">
                    <button
                      className="primary"
                      onClick={() => {
                        setRegisterOpen(true);
                        setRegistrationError("");
                        setRegistrationMessage("");
                      }}
                    >
                      <UserRound size={15} /> Register student
                    </button>
                    <label className="search">
                      <Search size={16} />
                      <input
                        placeholder="Search name, email, roll no..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Filter students by active status"
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value)
                      }
                      className="filter-select"
                    >
                      <option value="All">All students</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                    <button
                      className="secondary"
                      onClick={exportStudentsCsv}
                      disabled={!filteredStudents.length}
                    >
                      <Download size={15} /> Export CSV
                    </button>
                    <button
                      className="secondary"
                      onClick={load}
                      disabled={refreshing}
                    >
                      <RefreshCw
                        size={15}
                        className={refreshing ? "spin" : ""}
                      />{" "}
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="table-wrap" style={{ overflowX: "hidden", width: "100%" }}>
                  <table style={{ width: "100%", minWidth: 0, tableLayout: "fixed" }}>
                    <thead>
                      <tr>
                        <th style={{ width: "15%" }}>STUDENT</th>
                        <th style={{ width: "10%" }}>ENROLLMENT NO.</th>
                        <th style={{ width: "10%" }}>ROLL NUMBER</th>
                        <th style={{ width: "17%" }}>EMAIL</th>
                        <th style={{ width: "8%" }}>DEPARTMENT</th>
                        <th style={{ width: "6%" }}>SEMESTER</th>
                        <th style={{ width: "6%" }}>SECTION</th>
                        <th style={{ width: "8%" }}>STATUS</th>
                        <th style={{ width: "20%" }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan="9" className="empty">
                            Loading student records...
                          </td>
                        </tr>
                      ) : filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="empty">
                            {error
                              ? "Could not load student records."
                              : "No students match your search or filter."}
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student) => (
                          <tr key={student.id}>
                            <td>
                              <div className="student">
                                <StudentAvatar apiBase={apiBase} studentId={student.id} name={studentName(student)} />
                                <div>
                                  <b>{studentName(student)}</b>
                                  <small>
                                    Added{" "}
                                    {student.created_at
                                      ? displayDate(
                                          student.created_at.slice(0, 10)
                                        )
                                      : "date unavailable"}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td className="mono">
                              {student.enrollment_number || "—"}
                            </td>
                            <td className="mono">
                              {student.roll_number || "—"}
                            </td>
                            <td>
                              {student.email ? (
                                <span className="student-email">
                                  <Mail size={13} />
                                  {student.email}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>{student.department || "—"}</td>
                            <td>{student.semester ?? "—"}</td>
                            <td>{student.section || "—"}</td>
                            <td>
                              <span
                                className={`status ${
                                  student.is_active !== false
                                    ? "status-present"
                                    : "status-absent"
                                }`}
                              >
                                {student.is_active !== false
                                  ? "Active"
                                  : "Inactive"}
                              </span>
                            </td>
                            <td style={{ whiteSpace: "normal" }}>
                              <div style={{ display: "flex", gap: 5, alignItems: "center", justifyContent: "flex-start", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="secondary"
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", fontSize: 11, whiteSpace: "nowrap" }}
                                onClick={() => changeStudentStatus(student)}
                                title={student.is_active !== false ? "Deactivate student" : "Reactivate student"}
                                aria-label={`${student.is_active !== false ? "Deactivate" : "Reactivate"} ${studentName(student)}`}
                              >
                                {student.is_active !== false ? (
                                  <><UserX size={14} /> Deactivate</>
                                ) : (
                                  <><UserCheck size={14} /> Reactivate</>
                                )}
                              </button>
                              <button
                                type="button"
                                className="secondary danger"
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", fontSize: 11, whiteSpace: "nowrap" }}
                                onClick={() => permanentlyDeleteStudent(student)}
                                title="Permanently delete student"
                                aria-label={`Permanently delete ${studentName(student)}`}
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="table-foot">
                  <span>
                    Showing <b>{filteredStudents.length}</b> of{" "}
                    <b>{students.length}</b> students
                  </span>
                  <span>
                    <i className="inline-dot" /> Data from PostgreSQL API
                  </span>
                </div>
              </section>
            </>
          ) : page === "Subjects" ? (
            <>
              <section className="panel records">
                <div className="records-head">
                  <div><h2>Subject management</h2><p>Manage the subjects available when creating class sessions.</p></div>
                  <div className="record-actions"><button className="primary" onClick={() => openSubjectForm()}><Plus size={15} /> Add subject</button><button className="secondary" onClick={load} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "spin" : ""} /> Refresh</button></div>
                </div>
                {subjectError && <div className="error" role="alert"><AlertCircle size={17} /><span>{subjectError}</span></div>}
                {subjectMessage && <div className="success" role="status">{subjectMessage}</div>}
                <div className="table-wrap"><table><thead><tr><th>SUBJECT</th><th>CODE</th><th>DEPARTMENT</th><th>SEMESTER</th><th>CLASS SESSIONS</th><th>ACTIONS</th></tr></thead><tbody>
                  {subjects.length === 0 ? <tr><td colSpan="6" className="empty">No subjects yet. Add a subject to enable class-session creation.</td></tr> : subjects.map((subject) => { const relatedCount = sessions.filter((session) => String(session.subject_id || session.subject?.id || "") === String(subject.id)).length; return <tr key={subject.id}><td><div className="student"><span><BookOpen size={16} /></span><div><b>{subject.name || subject.subject_name || "Unnamed subject"}</b><small>{subject.is_active === false ? "Inactive" : "Available"}</small></div></div></td><td className="mono">{subject.code || "—"}</td><td>{subject.department || "—"}</td><td>{subject.semester ?? "—"}</td><td>{relatedCount}</td><td><div className="session-actions"><button className="secondary" onClick={() => openSubjectForm(subject)}>Edit</button><button className="secondary" style={{ color: "#b42318", borderColor: "#fecaca" }} onClick={() => deleteSubject(subject)}><Trash2 size={14} /> Delete</button></div></td></tr>; })}
                </tbody></table></div>
                <div className="table-foot"><span><b>{subjects.length}</b> subjects</span><span>Subjects with class sessions must be retained until those sessions are removed.</span></div>
              </section>
              {subjectFormOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !subjectBusy) setSubjectFormOpen(false); }}><section className="registration-modal session-modal" role="dialog" aria-modal="true" aria-labelledby="subject-title"><div className="registration-modal-header"><div><div className="eyebrow">SUBJECT MANAGEMENT</div><h2 id="subject-title">{editingSubjectId ? "Edit subject" : "Add subject"}</h2><p>Subject details are used by class sessions and attendance records.</p></div><button type="button" className="secondary icon-button" onClick={() => setSubjectFormOpen(false)} disabled={subjectBusy} aria-label="Close subject form"><X size={18} /></button></div>
                {subjectError && <div className="error registration-alert"><AlertCircle size={18} /><div><b>Could not save subject</b><p>{subjectError}</p></div></div>}
                <form onSubmit={saveSubject}><div className="registration-fields"><label>Subject code <span>*</span><input required maxLength={50} value={subjectForm.code} onChange={(event) => setSubjectForm((old) => ({ ...old, code: event.target.value }))} placeholder="e.g. IT-301" /></label><label>Subject name <span>*</span><input required maxLength={200} value={subjectForm.name} onChange={(event) => setSubjectForm((old) => ({ ...old, name: event.target.value }))} placeholder="e.g. Computer Networks" /></label><label>Department<input maxLength={150} value={subjectForm.department} onChange={(event) => setSubjectForm((old) => ({ ...old, department: event.target.value }))} placeholder="e.g. Information Technology" /></label><label>Semester<input type="number" min="1" max="20" value={subjectForm.semester} onChange={(event) => setSubjectForm((old) => ({ ...old, semester: event.target.value }))} placeholder="e.g. 5" /></label></div><div className="registration-modal-footer"><span className="registration-hint">Subject code must be unique.</span><div><button type="button" className="secondary" onClick={() => setSubjectFormOpen(false)} disabled={subjectBusy}>Cancel</button><button type="submit" className="primary" disabled={subjectBusy}>{subjectBusy ? "Saving…" : editingSubjectId ? "Save changes" : "Create subject"}</button></div></div></form></section></div>}
            </>
          ) : page === "Class sessions" ? (
            <section className="panel records">
              <div className="records-head">
                <div>
                  <h2>Class sessions</h2>
                  <p>Sessions retrieved from the database</p>
                </div>
                <div className="record-actions">
                  <button className="primary" onClick={openSessionForm} disabled={sessionBusy}>
                    <Plus size={15} /> Create session
                  </button>
                  <label className="search">
                    <Search size={16} />
                    <input
                      placeholder="Search subject or session ID..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <button
                    className="secondary"
                    onClick={load}
                    disabled={refreshing}
                  >
                    <RefreshCw size={15} /> Refresh
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SUBJECT / SESSION DETAILS</th>
                      <th>DATE &amp; TIME</th>
                      <th>SESSION ID (REFERENCE)</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="4" className="empty">
                          Loading class sessions...
                        </td>
                      </tr>
                    ) : sessions.filter((session) =>
                        `${sessionSubjectName(session)} ${
                          sessionIdentifier(session)
                        } ${session.session_date || ""}`
                          .toLowerCase()
                          .includes(search.toLowerCase())
                      ).length === 0 ? (
                      <tr>
                        <td colSpan="4" className="empty">
                          No class sessions found.
                        </td>
                      </tr>
                    ) : (
                      sessions
                        .filter((session) =>
                          `${sessionSubjectName(session)} ${
                            sessionIdentifier(session)
                          } ${session.session_date || ""}`
                            .toLowerCase()
                            .includes(search.toLowerCase())
                        )
                        .map((session) => {
                          const id = sessionIdentifier(session);
                          return (
                            <tr key={id}>
                              <td>
                                <div className="student">
                                  <span>
                                    <BookOpen size={16} />
                                  </span>
                                  <div>
                                    <b>
                                      {sessionSubjectName(session)}
                                    </b>
                                    <small>{session.room ? `Room ${session.room}` : "Class session"}{session.faculty_name ? ` · ${session.faculty_name}` : ""}</small>
                                  </div>
                                </div>
                              </td>
                              <td>{displayDate(session.session_date)}<br /><small>{time(session.start_time)}–{time(session.end_time)}</small></td>
                              <td className="mono">{id || "—"}</td>
                              <td>
                                <div className="session-actions">
                                  <button
                                    className="secondary"
                                    onClick={() => {
                                      setSessionId(id);
                                      setPage("Overview");
                                      setSearch("");
                                      setStatusFilter("All");
                                    }}
                                  >
                                    Load session
                                  </button>
                                  <button
                                    className="secondary"
                                    onClick={() => {
                                      setSessionId(id);
                                      setPage("Attendance");
                                      setSearch("");
                                      setStatusFilter("All");
                                    }}
                                  >
                                    View attendance
                                  </button>
                                  <button
                                    className="secondary"
                                    onClick={() => exportClassSessionCsv(session)}
                                    disabled={!id || exportingSessionId === id}
                                    title="Export this class session's summary and attendance records as CSV"
                                  >
                                    <Download size={14} /> {exportingSessionId === id ? "Exporting…" : "Export CSV"}
                                  </button>
                                  <button className="secondary" style={{ color: "#b42318", borderColor: "#fecaca" }} disabled={deletingSessionId === id} onClick={() => deleteClassSession(session)}><Trash2 size={14} /> {deletingSessionId === id ? "Deleting…" : "Delete"}</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="table-foot">
                <span>
                  Showing <b>{sessions.length}</b> sessions
                </span>
                <span>
                  <Hash size={13} /> Session list from API
                </span>
              </div>
            </section>
          ) : (
            <>
              <section className="metrics">
                <Metric
                  icon={Users}
                  title="Total students"
                  value={loading ? "—" : roster}
                  detail={
                    Number(apiRoster) > 0
                      ? "Active subject cohort"
                      : "Active students registered"
                  }
                  tone="blue"
                />
                <Metric
                  icon={CheckCircle2}
                  title="Present today"
                  value={loading ? "—" : present}
                  detail="Marked present"
                  tone="green"
                />
                <Metric
                  icon={Clock3}
                  title="Late arrivals"
                  value={loading ? "—" : late}
                  detail="Attendance marked late"
                  tone="amber"
                />
                <Metric
                  icon={Activity}
                  title="Attendance rate"
                  value={loading ? "—" : `${rate.toFixed(1)}%`}
                  detail={`${present + late} attended · ${totalRecords} records`}
                  tone="purple"
                />
              </section>

              <section className="middle">
                <article className="panel overview">
                  <div className="panel-head">
                    <div>
                      <h2>Attendance overview</h2>
                      <p>Class session status breakdown</p>
                    </div>
                    <span className="chip">
                      {stats?.session_date || date}
                    </span>
                  </div>

                  <div className="chart-area">
                    <div
                      className="donut"
                      style={{
                        "--p": present,
                        "--l": late,
                        "--a": absent,
                        "--e": excused,
                        "--total": Math.max(totalRecords, 1),
                      }}
                    >
                      <div style={{ background: "#ffffff", color: "#14213a", borderRadius: "50%", width: "74%", height: "74%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
                        <b style={{ color: "#14213a", fontSize: "clamp(24px, 2.4vw, 34px)", fontWeight: 900, lineHeight: 1.1, opacity: 1 }}>{rate.toFixed(0)}%</b>
                        <span style={{ color: "#52627a", fontSize: 11, fontWeight: 700, marginTop: 5 }}>Attendance</span>
                      </div>
                    </div>
                    <div className="legend">
                      <Legend color="green" label="Present" value={present} />
                      <Legend color="amber" label="Late" value={late} />
                      <Legend color="gray" label="Absent" value={absent} />
                      <Legend color="purple" label="Excused" value={excused} />
                      <small>Based on records returned by the API.</small>
                    </div>
                  </div>

                  <div className="panel-foot">
                    <span>
                      <ShieldCheck size={15} />
                      Live data from PostgreSQL API
                    </span>
                    <button onClick={() => setPage("Attendance")}>
                      View attendance →
                    </button>
                  </div>
                </article>

                <article className="panel session">
                  <div className="panel-head">
                    <div>
                      <h2>Selected class session</h2>
                      <p>Session currently shown in dashboard</p>
                    </div>
                    <span className="loaded">● Loaded</span>
                  </div>

                  <div className="subject">
                    <div>
                      <BookOpen size={21} />
                    </div>
                    <section>
                      <b>
                        {records[0]?.subject_name || "Software Engineering"}
                      </b>
                      <small>Class attendance session</small>
                    </section>
                  </div>

                  <label>Class session ID</label>
                  <input
                    value={sessionId}
                    onChange={(event) => setSessionId(event.target.value)}
                  />

                  <div className="session-numbers">
                    <div>
                      <small>Recorded entries</small>
                      <b>{totalRecords}</b>
                    </div>
                    <div>
                      <small>Students in cohort</small>
                      <b>{roster ?? "—"}</b>
                    </div>
                  </div>

                  <button
                    className="secondary full"
                    onClick={load}
                    disabled={refreshing}
                  >
                    <RefreshCw size={15} /> Load session
                  </button>
                </article>
              </section>

              <section className="panel records">
                <div className="records-head">
                  <div>
                    <h2>Recent attendance</h2>
                    <p>Latest records for the selected class session</p>
                  </div>
                  <div className="record-actions">
                    <label className="search">
                      <Search size={16} />
                      <input
                        placeholder="Search students..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </label>
                    <button
                      className="secondary"
                      onClick={exportCsv}
                      disabled={!filtered.length}
                    >
                      <Download size={15} /> Export CSV
                    </button>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>STUDENT</th>
                        <th>ENROLLMENT NO.</th>
                        <th>CHECK-IN TIME</th>
                        <th>SIMILARITY</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan="5" className="empty">
                            Loading records...
                          </td>
                        </tr>
                      ) : filtered.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="empty">
                            No attendance records match your search.
                          </td>
                        </tr>
                      ) : (
                        filtered.map((record) => (
                          <tr key={record.attendance_id}>
                            <td>
                              <div className="student">
                                <StudentAvatar apiBase={apiBase} studentId={record.student_id} name={record.student_name} />
                                <div>
                                  <b>
                                    {record.student_name || "Unknown student"}
                                  </b>
                                  <small>
                                    {record.subject_name || "Enrolled student"}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td className="mono">
                              {record.enrollment_number || "—"}
                            </td>
                            <td>{time(record.check_in_time)}</td>
                            <td>
                              {record.recognition_similarity == null
                                ? "—"
                                : `${(
                                    Number(record.recognition_similarity) * 100
                                  ).toFixed(1)}%`}
                            </td>
                            <td>
                              <span className={statusClass(record.status)}>
                                {record.status || "Unknown"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="table-foot">
                  <span>
                    Showing <b>{filtered.length}</b> of{" "}
                    <b>{records.length}</b> records
                  </span>
                  <span>Session date: {stats?.session_date || "—"}</span>
                </div>
              </section>
            </>
          )}

          {sessionModalOpen && (
            <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
              if (event.target === event.currentTarget && !sessionBusy) closeSessionForm();
            }}>
              <section className="registration-modal session-modal" role="dialog" aria-modal="true" aria-labelledby="session-title">
                <div className="registration-modal-header">
                  <div>
                    <div className="eyebrow">SESSION MANAGEMENT</div>
                    <h2 id="session-title">Create class session</h2>
                    <p>Choose a subject and set the date and class timing.</p>
                  </div>
                  <button type="button" className="secondary icon-button" onClick={closeSessionForm} disabled={sessionBusy} aria-label="Close session form"><X size={18} /></button>
                </div>
                {sessionError && <div className="error registration-alert"><AlertCircle size={18} /><div><b>Could not create class session</b><p>{sessionError}</p></div></div>}
                {sessionMessage && <div className="registration-success"><CheckCircle2 size={18} /><span>{sessionMessage}</span></div>}
                <form onSubmit={createClassSession}>
                  <div className="registration-fields">
                    <label className="field-wide">Subject <span>*</span>
                      <select required value={sessionForm.subject_id} onChange={(event) => setSessionForm((old) => ({ ...old, subject_id: event.target.value }))} disabled={!subjects.length} style={{ width: "100%", padding: "10px 11px", border: "1px solid #dbe2ea", borderRadius: 9, background: "#fff", color: "#172033", font: "inherit", boxSizing: "border-box" }}>
                        <option value="">{subjects.length ? "Select a subject" : "No subjects available"}</option>
                        {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code ? `${subject.code} — ` : ""}{subject.name || subject.subject_name || subject.title || subject.id}</option>)}
                      </select>
                      {!subjects.length && <small className="registration-hint">If this list is empty, create a subject first or check the API connection.</small>}
                    </label>
                    <label>Session date <span>*</span><input type="date" required value={sessionForm.session_date} onChange={(event) => setSessionForm((old) => ({ ...old, session_date: event.target.value }))} /></label>
                    <label>Room<input maxLength={100} value={sessionForm.room} onChange={(event) => setSessionForm((old) => ({ ...old, room: event.target.value }))} placeholder="e.g. Lab 2" /></label>
                    <label>Start time <span>*</span><input type="time" required value={sessionForm.start_time} onChange={(event) => setSessionForm((old) => ({ ...old, start_time: event.target.value }))} /></label>
                    <label>End time <span>*</span><input type="time" required value={sessionForm.end_time} onChange={(event) => setSessionForm((old) => ({ ...old, end_time: event.target.value }))} /></label>
                    <label className="field-wide">Faculty name<input maxLength={150} value={sessionForm.faculty_name} onChange={(event) => setSessionForm((old) => ({ ...old, faculty_name: event.target.value }))} placeholder="Enter faculty name (optional)" /></label>
                  </div>
                  <div className="registration-modal-footer">
                    <span className="registration-hint">Fields marked * are required. End time must be later than start time.</span>
                    <div>
                      <button type="button" className="secondary" onClick={closeSessionForm} disabled={sessionBusy}>Cancel</button>
                      <button type="submit" className="primary" disabled={sessionBusy || !subjects.length}>{sessionBusy ? <><RefreshCw size={15} className="spin" /> Creating…</> : <><Plus size={15} /> Create session</>}</button>
                    </div>
                  </div>
                </form>
              </section>
            </div>
          )}

          {registerOpen && (
            <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
              if (event.target === event.currentTarget && !registrationBusy) resetRegistration();
            }}>
              <section className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="register-title">
                <div className="registration-modal-header">
                  <div>
                    <div className="eyebrow">STUDENT MANAGEMENT</div>
                    <h2 id="register-title">Register student</h2>
                    <p>Add student details and enroll a face using an image or camera.</p>
                  </div>
                  <button type="button" className="secondary icon-button" onClick={resetRegistration} disabled={registrationBusy} aria-label="Close registration">
                    <X size={18} />
                  </button>
                </div>

                {registrationError && <div className="error registration-alert"><AlertCircle size={18} /><div><b>Could not complete registration</b><p>{registrationError}</p></div></div>}
                {registrationMessage && <div className="registration-success"><CheckCircle2 size={18} /><span>{registrationMessage}</span></div>}

                <form onSubmit={registerStudent}>
                  <div className="registration-layout">
                    <div className="face-capture-panel">
                      <h3>Student face image</h3>
                      <p className="registration-hint">Use a clear, front-facing photo with one person's face visible.</p>

                      {cameraActive ? (
                        <div className="camera-preview">
                          <video ref={cameraVideoRef} autoPlay playsInline muted />
                          <div className="camera-controls">
                            <button type="button" className="primary" onClick={captureCameraPhoto}>
                              <Camera size={15} /> Capture photo
                            </button>
                            <button type="button" className="secondary" onClick={stopCamera}>Cancel camera</button>
                          </div>
                        </div>
                      ) : facePreview ? (
                        <div className="face-image-preview">
                          <img src={facePreview} alt="Selected student face preview" />
                          <span className="image-ready"><CheckCircle2 size={14} /> Image ready</span>
                          <div className="capture-actions">
                            <label className="secondary upload-label">
                              <Download size={14} /> Choose another image
                              <input type="file" accept="image/*" hidden onChange={(event) => chooseFaceImage(event.target.files?.[0])} />
                            </label>
                            <button type="button" className="secondary" onClick={startCamera}>
                              <Camera size={15} /> Retake with camera
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="face-empty-state">
                          <div className="face-placeholder"><UserRound size={38} /></div>
                          <b>No image selected</b>
                          <span>Upload a photo or open your camera.</span>
                          <div className="capture-actions">
                            <label className="primary upload-label">
                              <Download size={15} /> Upload image
                              <input type="file" accept="image/*" hidden onChange={(event) => chooseFaceImage(event.target.files?.[0])} />
                            </label>
                            <button type="button" className="secondary" onClick={startCamera}>
                              <Camera size={15} /> Open camera
                            </button>
                          </div>
                        </div>
                      )}
                      <small className="registration-hint">Supported image types depend on your browser. Maximum file size: 10 MB.</small>
                    </div>

                    <div className="student-form-panel">
                      <h3>Student information</h3>
                      <div className="registration-fields">
                        <label>First name <span>*</span>
                          <input required value={studentForm.first_name} onChange={(event) => setStudentForm((old) => ({ ...old, first_name: event.target.value }))} placeholder="Enter first name" />
                        </label>
                        <label>Last name
                          <input value={studentForm.last_name} onChange={(event) => setStudentForm((old) => ({ ...old, last_name: event.target.value }))} placeholder="Enter last name" />
                        </label>
                        <label>Enrollment number <span>*</span>
                          <input required value={studentForm.enrollment_number} onChange={(event) => setStudentForm((old) => ({ ...old, enrollment_number: event.target.value }))} placeholder="e.g. 23GCEBIT068" />
                        </label>
                        <label>Roll number
                          <input value={studentForm.roll_number} onChange={(event) => setStudentForm((old) => ({ ...old, roll_number: event.target.value }))} placeholder="Enter roll number" />
                        </label>
                        <label className="field-wide">Email
                          <input type="email" value={studentForm.email} onChange={(event) => setStudentForm((old) => ({ ...old, email: event.target.value }))} placeholder="student@example.com" />
                        </label>
                        <label>Department
                          <input value={studentForm.department} onChange={(event) => setStudentForm((old) => ({ ...old, department: event.target.value }))} placeholder="e.g. Information Technology" />
                        </label>
                        <label>Semester
                          <input type="number" min="1" max="12" value={studentForm.semester} onChange={(event) => setStudentForm((old) => ({ ...old, semester: event.target.value }))} placeholder="e.g. 7" />
                        </label>
                        <label>Section
                          <input value={studentForm.section} onChange={(event) => setStudentForm((old) => ({ ...old, section: event.target.value }))} placeholder="e.g. A" />
                        </label>
                      </div>
                      <div className="registration-note">
                        <ShieldCheck size={17} />
                        <span>The image is sent to the backend for face processing. Registration is complete only when the API confirms the operation.</span>
                      </div>
                    </div>
                  </div>

                  <div className="registration-modal-footer">
                    <span className="registration-hint">Fields marked * are required.</span>
                    <div>
                      <button type="button" className="secondary" onClick={resetRegistration} disabled={registrationBusy}>Cancel</button>
                      <button type="submit" className="primary" disabled={registrationBusy || cameraActive}>
                        {registrationBusy ? <><RefreshCw size={15} className="spin" /> Registering…</> : <><UserRound size={15} /> Register student</>}
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            </div>
          )}

          <footer className="footer">
            <span>© 2026 FaceAttendanceAI</span>
            <span>
              <i /> Attendance dashboard ·{" "}
              <a
                href="http://127.0.0.1:8000/docs"
                target="_blank"
                rel="noreferrer"
              >
                API documentation
              </a>
            </span>
          </footer>
        </div>
      </main>
    </div>
    </>
  );
}

function Metric({ icon: Icon, title, value, detail, tone }) {
  return (
    <article className="metric">
      <div className="metric-top">
        <span className={`metric-icon ${tone}`}>
          <Icon size={19} />
        </span>
        <span className="metric-mini">●</span>
      </div>
      <p>{title}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Legend({ color, label, value }) {
  return (
    <div className="legend-row">
      <i className={color} />
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export default App;
