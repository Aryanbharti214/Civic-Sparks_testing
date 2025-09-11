
VANTA.NET({
    el: "#bg",
    mouseControls: true,
    touchControls: true,
    minHeight: 200,
    minWidth: 200,
    scale: 1.0,
    scaleMobile: 1.0,
    color: 0xff4d4d,
    backgroundColor: 0x0d0d0d,
    points: 12,
    maxDistance: 22,
    spacing: 18
});


const SUPABASE_URL = 'https://gvdfqcljvdskkisnvoubkw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZGZxY2xqdmtraXNudm91Ymt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NzMc2ODQsImV4cCI6MjA3MzA0OTY4NH0.accgwK0kOLpq1AD6NqraDNSAyxrLwCoxyxfMBJAacIk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


function dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, {
        type: mime
    });
}

async function uploadFileToBucket(path, file) {
    const {
        data,
        error
    } = await supabaseClient.storage.from('reports').upload(path, file, {
        upsert: false
    });
    if (error) throw error;
    return data;
}

async function getSignedUrlForPath(path, expires = 60 * 60) {
    const {
        data,
        error
    } = await supabaseClient.storage.from('reports').createSignedUrl(path, expires);
    if (error) throw error;
    return data?.signedUrl || null;
}

function getPublicUrlForPath(path) {
    const {
        data
    } = supabaseClient.storage.from('reports').getPublicUrl(path);
    return data?.publicUrl || null;
}


function goto(id) {
    const pages = ['page0', 'userLogin', 'adminLogin', 'page3', 'page4'];
    pages.forEach(p => {
        document.getElementById(p).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
    if (id === 'page3') {
        renderUserReports();
    }
    if (id === 'page4') {
        renderAllReports();
        updateCharts();
    }
}

let currentUserEmail = null;
let currentUserId = null;

function decodeJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

async function handleCredentialResponse(response) {
    const payload = decodeJwt(response.credential);
    if (!payload || !payload.email) {
        alert(translations[currentLang].signInFailedAlert);
        return;
    }

    try {
        // Exchange Google ID token for a Supabase session (optional; helpful for RLS & storage)
        await supabaseClient.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential
        }).catch(e => console.warn(e));
        const {
            data: sessData
        } = await supabaseClient.auth.getSession();
        const supUser = sessData?.session?.user;
        currentUserEmail = supUser?.email ?? payload.email;
        currentUserId = supUser?.id ?? null;
        localStorage.setItem('civic_current_user', currentUserEmail);
        if (currentUserId) localStorage.setItem('civic_user_id', currentUserId);
        goto('page3');
    } catch (err) {
        console.error(err);
        alert(translations[currentLang].signInErrorAlert);
    }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    const user = session?.user ?? null;
    if (user) {
        currentUserEmail = user.email;
        currentUserId = user.id;
        localStorage.setItem('civic_current_user', currentUserEmail);
        localStorage.setItem('civic_user_id', currentUserId);
    } else {
        currentUserEmail = null;
        currentUserId = null;
        localStorage.removeItem('civic_current_user');
        localStorage.removeItem('civic_user_id');
    }
});


async function adminLogin() {
    const id = document.getElementById('adminId').value.trim();
    const pass = document.getElementById('adminPass').value.trim();
    const err = document.getElementById('adminError');

    // Keep your original admin flow: create this admin in Supabase Auth (email civic01@yourdomain.com)
    if (id === 'civic01') {
        try {
            const email = 'civic01@yourdomain.com'; // create this user in Supabase Auth or change to your admin email
            const {
                data,
                error
            } = await supabaseClient.auth.signInWithPassword({
                email,
                password: pass
            });
            if (error) throw error;
            err.classList.add('hidden');
            document.getElementById('adminId').value = '';
            document.getElementById('adminPass').value = '';
            goto('page4');
        } catch (e) {
            console.error(e);
            err.classList.remove('hidden');
        }
    } else {
        err.classList.remove('hidden');
    }
}

function togglePasswordVisibility() {
    const passInput = document.getElementById('adminPass');
    const toggleBtn = document.querySelector('.password-toggle-btn');
    if (passInput.type === 'password') {
        passInput.type = 'text';
        toggleBtn.textContent = '🙈';
    } else {
        passInput.type = 'password';
        toggleBtn.textContent = '👁️';
    }
}


let camStream = null,
    vidRecorder = null,
    vidChunks = [],
    audRecorder = null,
    audChunks = [];

const imgVideo = document.getElementById('imgVideo');
const imgCanvas = document.getElementById('imgCanvas');
const imgPreview = document.getElementById('imgPreview');
const removeImgBtn = document.getElementById('removeImgBtn');

document.getElementById('startCamBtn').onclick = async () => {
    try {
        camStream = await navigator.mediaDevices.getUserMedia({
            video: true
        });
        imgVideo.srcObject = camStream;
        imgVideo.classList.remove('hidden');
        document.getElementById('imgCamControls').classList.remove('hidden');
    } catch (error) {
        console.error("Error accessing camera:", error);
        alert(translations[currentLang].cameraErrorAlert);
    }
};
document.getElementById('takePhotoBtn').onclick = () => {
    imgCanvas.width = imgVideo.videoWidth;
    imgCanvas.height = imgVideo.videoHeight;
    imgCanvas.getContext('2d').drawImage(imgVideo, 0, 0);
    imgPreview.src = imgCanvas.toDataURL('image/png');
    imgPreview.classList.remove('hidden');
    removeImgBtn.classList.remove('hidden');
};
document.getElementById('stopCamBtn').onclick = () => {
    if (camStream) {
        camStream.getTracks().forEach(t => t.stop());
        camStream = null;
    }
    imgVideo.classList.add('hidden');
    document.getElementById('imgCamControls').classList.add('hidden');
};
removeImgBtn.onclick = () => {
    imgPreview.classList.add('hidden');
    removeImgBtn.classList.add('hidden');
};


const vidPreview = document.getElementById('vidPreview');
const removeVidBtn = document.getElementById('removeVidBtn');

document.getElementById('startVidRec').onclick = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        vidRecorder = new MediaRecorder(stream);
        vidChunks = [];
        vidRecorder.ondataavailable = e => vidChunks.push(e.data);
        vidRecorder.onstop = () => {
            vidPreview.src = URL.createObjectURL(new Blob(vidChunks, {
                type: 'video/webm'
            }));
            vidPreview.classList.remove('hidden');
            removeVidBtn.classList.remove('hidden');
        };
        vidRecorder.start();
        document.getElementById('stopVidRec').classList.remove('hidden');
        document.getElementById('startVidRec').classList.add('hidden');
    } catch (error) {
        console.error("Error accessing video recorder:", error);
        alert(translations[currentLang].videoRecorderErrorAlert);
    }
};

document.getElementById('stopVidRec').onclick = () => {
    if (vidRecorder) {
        vidRecorder.stop();
        vidRecorder = null;
    }
    document.getElementById('stopVidRec').classList.add('hidden');
    document.getElementById('startVidRec').classList.remove('hidden');
};
removeVidBtn.onclick = () => {
    vidPreview.classList.add('hidden');
    removeVidBtn.classList.add('hidden');
};


const audPreview = document.getElementById('audPreview');
const removeAudBtn = document.getElementById('removeAudBtn');

document.getElementById('startAudRec').onclick = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });
        audRecorder = new MediaRecorder(stream);
        audChunks = [];
        audRecorder.ondataavailable = e => audChunks.push(e.data);
        audRecorder.onstop = () => {
            audPreview.src = URL.createObjectURL(new Blob(audChunks, {
                type: 'audio/webm'
            }));
            audPreview.classList.remove('hidden');
            removeAudBtn.classList.remove('hidden');
        };
        audRecorder.start();
        document.getElementById('stopAudRec').classList.remove('hidden');
        document.getElementById('startAudRec').classList.add('hidden');
    } catch (error) {
        console.error("Error accessing audio recorder:", error);
        alert(translations[currentLang].audioRecorderErrorAlert);
    }
};

document.getElementById('stopAudRec').onclick = () => {
    if (audRecorder) {
        audRecorder.stop();
        audRecorder = null;
    }
    document.getElementById('stopAudRec').classList.add('hidden');
    document.getElementById('startAudRec').classList.remove('hidden');
};
removeAudBtn.onclick = () => {
    audPreview.classList.add('hidden');
    removeAudBtn.classList.add('hidden');
};

async function submitReport() {
    const current = localStorage.getItem('civic_current_user') || currentUserEmail;
    const userId = localStorage.getItem('civic_user_id') || currentUserId;

    if (!current) {
        alert(translations[currentLang].signInFirstAlert);
        goto('userLogin');
        return;
    }
    const desc = document.getElementById('issueDesc').value.trim();
    const cat = document.getElementById('issueCat').value;
    const loc = document.getElementById('locationTxt').value.trim();
    if (!desc || !cat || !loc) {
        alert(translations[currentLang].fillRequiredFieldsAlert);
        return;
    }

    // prepare paths
    let img_path = null,
        vid_path = null,
        aud_path = null;

    // IMAGE: prefer file input, else use captured preview (dataURL)
    const imgFileInput = document.getElementById('imgUpload');
    try {
        if (imgFileInput && imgFileInput.files && imgFileInput.files[0]) {
            const f = imgFileInput.files[0];
            const path = `${userId || 'anon'}/images/${Date.now()}_${f.name}`;
            await uploadFileToBucket(path, f);
            img_path = path;
        } else if (!imgPreview.classList.contains('hidden') && imgPreview.src) {
            const f = dataURLtoFile(imgPreview.src, `${Date.now()}_photo.png`);
            const path = `${userId || 'anon'}/images/${Date.now()}_photo.png`;
            await uploadFileToBucket(path, f);
            img_path = path;
        }
    } catch (e) {
        console.error('Image upload failed', e);
        alert(translations[currentLang].imageUploadFailedAlert + e.message);
        return;
    }

    // VIDEO: prefer file input, else recorded chunks
    const vidFileInput = document.getElementById('vidUpload');
    try {
        if (vidFileInput && vidFileInput.files && vidFileInput.files[0]) {
            const f = vidFileInput.files[0];
            const path = `${userId || 'anon'}/videos/${Date.now()}_${f.name}`;
            await uploadFileToBucket(path, f);
            vid_path = path;
        } else if (vidChunks && vidChunks.length) {
            const blob = new Blob(vidChunks, {
                type: 'video/webm'
            });
            const f = new File([blob], `${Date.now()}_record.webm`, {
                type: 'video/webm'
            });
            const path = `${userId || 'anon'}/videos/${Date.now()}_record.webm`;
            await uploadFileToBucket(path, f);
            vid_path = path;
            vidChunks = [];
        }
    } catch (e) {
        console.error('Video upload failed', e);
        alert(translations[currentLang].videoUploadFailedAlert + e.message);
        return;
    }

    // AUDIO: same approach
    const audFileInput = document.getElementById('audUpload');
    try {
        if (audFileInput && audFileInput.files && audFileInput.files[0]) {
            const f = audFileInput.files[0];
            const path = `${userId || 'anon'}/audio/${Date.now()}_${f.name}`;
            await uploadFileToBucket(path, f);
            aud_path = path;
        } else if (audChunks && audChunks.length) {
            const blob = new Blob(audChunks, {
                type: 'audio/webm'
            });
            const f = new File([blob], `${Date.now()}_rec.webm`, {
                type: 'audio/webm'
            });
            const path = `${userId || 'anon'}/audio/${Date.now()}_rec.webm`;
            await uploadFileToBucket(path, f);
            aud_path = path;
            audChunks = [];
        }
    } catch (e) {
        console.error('Audio upload failed', e);
        alert(translations[currentLang].audioUploadFailedAlert + e.message);
        return;
    }

    // Insert DB row
    try {
        const repId = Date.now();
        const {
            data,
            error
        } = await supabaseClient.from('reports').insert([{
            id: repId,
            user_email: current,
            desc,
            cat,
            location: loc,
            lat: null,
            lng: null,
            img_url: img_path,
            vid_url: vid_path,
            aud_url: aud_path,
            status: 'Submitted'
        }]);
        if (error) throw error;

        
        document.getElementById('issueDesc').value = '';
        document.getElementById('issueCat').value = '';
        document.getElementById('locationTxt').value = '';
        imgPreview.classList.add('hidden');
        vidPreview.classList.add('hidden');
        audPreview.classList.add('hidden');
        removeImgBtn.classList.add('hidden');
        removeVidBtn.classList.add('hidden');
        removeAudBtn.classList.add('hidden');
        const msg = document.getElementById('submitMsg');
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 2000);
        renderUserReports();
        updateCharts();
    } catch (e) {
        console.error('DB insert failed', e);
        alert(translations[currentLang].saveReportFailedAlert + (e.message || e));
    }
}


async function renderUserReports() {
    const reportsList = document.getElementById('userReports');
    reportsList.innerHTML = `<p class="small">${translations[currentLang].loadingMessage}</p>`;
    const current = localStorage.getItem('civic_current_user') || currentUserEmail;
    if (!current) {
        reportsList.innerHTML = `<p class="small">${translations[currentLang].signInToViewReports}</p>`;
        return;
    }

    try {
        const {
            data: rows,
            error
        } = await supabaseClient.from('reports').select('*').eq('user_email', current).order('created_at', {
            ascending: false
        });
        if (error) throw error;
        reportsList.innerHTML = '';
        for (const r of rows) {
            let mediaHtml = '';
            if (r.img_url) {
                let url = null;
                try {
                    url = await getSignedUrlForPath(r.img_url, 3600);
                } catch (e) {
                    url = getPublicUrlForPath(r.img_url);
                }
                if (url) mediaHtml += `<div style="margin-top:8px"><img src="${url}" class="preview"></div>`;
            }
            if (r.vid_url) {
                let url = null;
                try {
                    url = await getSignedUrlForPath(r.vid_url, 3600);
                } catch (e) {
                    url = getPublicUrlForPath(r.vid_url);
                }
                if (url) mediaHtml += `<div style="margin-top:8px"><video src="${url}" controls class="preview"></video></div>`;
            }
            if (r.aud_url) {
                let url = null;
                try {
                    url = await getSignedUrlForPath(r.aud_url, 3600);
                } catch (e) {
                    url = getPublicUrlForPath(r.aud_url);
                }
                if (url) mediaHtml += `<div style="margin-top:8px"><audio src="${url}" controls class="preview"></audio></div>`;
            }

            const inner = `
                <div class="report">
                  <p><b>${escapeHtml(r.cat)}</b> - ${escapeHtml(r.desc)}</p>
                  <p class="small">📍 ${escapeHtml(r.location || '')}</p>
                  ${mediaHtml}
                  <p class="small">${translations[currentLang].statusLabel}: ${escapeHtml(r.status)}</p>
                </div>
              `;
            reportsList.innerHTML += inner;
        }
    } catch (e) {
        console.error(e);
        reportsList.innerHTML = `<p class="small">${translations[currentLang].failedToLoadReports}</p>`;
    }
}

async function renderAllReports() {
    const reportsList = document.getElementById('allReports');
    reportsList.innerHTML = `<p class="small">${translations[currentLang].loadingMessage}</p>`;
    try {
        const {
            data: rows,
            error
        } = await supabaseClient.from('reports').select('*').order('created_at', {
            ascending: false
        });
        if (error) throw error;
        reportsList.innerHTML = '';
        for (const r of rows) {
            let mediaHtml = '';
            if (r.img_url) {
                let url = null;
                try {
                    url = await getSignedUrlForPath(r.img_url, 3600);
                } catch (e) {
                    url = getPublicUrlForPath(r.img_url);
                }
                if (url) mediaHtml += `<div style="margin-top:8px"><img src="${url}" class="preview"></div>`;
            }
            if (r.vid_url) {
                let url = null;
                try {
                    url = await getSignedUrlForPath(r.vid_url, 3600);
                } catch (e) {
                    url = getPublicUrlForPath(r.vid_url);
                }
                if (url) mediaHtml += `<div style="margin-top:8px"><video src="${url}" controls class="preview"></video></div>`;
            }
            if (r.aud_url) {
                let url = null;
                try {
                    url = await getSignedUrlForPath(r.aud_url, 3600);
                } catch (e) {
                    url = getPublicUrlForPath(r.aud_url);
                }
                if (url) mediaHtml += `<div style="margin-top:8px"><audio src="${url}" controls class="preview"></audio></div>`;
            }

            const inner = `
                <div class="report">
                  <p><b>${escapeHtml(r.cat)}</b> - ${escapeHtml(r.desc)}</p>
                  <p class="small">📍 ${escapeHtml(r.location || '')}</p>
                  ${mediaHtml}
                  <p class="small">${translations[currentLang].statusLabel}: ${escapeHtml(r.status)}</p>
                  <div class="controls" style="margin-top:8px">
                    <button class="btn" onclick="adminUpdate('${r.id}','Accepted')">${translations[currentLang].acceptBtn}</button>
                    <button class="btn" onclick="adminUpdate('${r.id}','In Progress')">${translations[currentLang].inProgressBtn}</button>
                    <button class="btn" onclick="adminUpdate('${r.id}','Resolved')">${translations[currentLang].resolvedBtn}</button>
                    <button class="btn btn-danger" onclick="adminDelete('${r.id}','${r.img_url || ''}','${r.vid_url || ''}','${r.aud_url || ''}')">${translations[currentLang].deleteBtn}</button>
                  </div>
                </div>
              `;
            reportsList.innerHTML += inner;
        }
    } catch (e) {
        console.error(e);
        reportsList.innerHTML = `<p class="small">${translations[currentLang].failedToLoadReports}</p>`;
    }
}

async function adminUpdate(reportId, status) {
    try {
        const {
            data,
            error
        } = await supabaseClient.from('reports').update({
            status
        }).eq('id', reportId);
        if (error) throw error;
        renderAllReports();
        updateCharts();
    } catch (e) {
        alert(translations[currentLang].updateFailedAlert + (e.message || e));
    }
}

async function adminDelete(reportId, imgPath, vidPath, audPath) {
    if (!confirm(translations[currentLang].deleteConfirmation)) return;
    try {
        const pathsToRemove = [];
        if (imgPath) pathsToRemove.push(imgPath);
        if (vidPath) pathsToRemove.push(vidPath);
        if (audPath) pathsToRemove.push(audPath);
        if (pathsToRemove.length) {
            const {
                error: rmErr
            } = await supabaseClient.storage.from('reports').remove(pathsToRemove);
            if (rmErr) console.warn('could not remove some files:', rmErr);
        }
        const {
            error
        } = await supabaseClient.from('reports').delete().eq('id', reportId);
        if (error) throw error;
        renderAllReports();
        updateCharts();
    } catch (e) {
        alert(translations[currentLang].deleteFailedAlert + (e.message || e));
    }
}


let chartObj = null;
async function updateCharts() {
    try {
        const {
            data: rows,
            error
        } = await supabaseClient.from('reports').select('status');
        if (error) throw error;
        const counts = {
            'Submitted': 0,
            'Accepted': 0,
            'In Progress': 0,
            'Resolved': 0
        };
        rows.forEach(r => {
            if (counts[r.status] !== undefined) counts[r.status]++;
        });
        const ctx = document.getElementById('statusChart').getContext('2d');
        const data = {
            labels: Object.keys(counts).map(key => translations[currentLang][`status${key.replace(/\s/g, '')}`]),
            datasets: [{
                label: translations[currentLang].reportsCountLabel,
                data: Object.values(counts),
                backgroundColor: ['#ff4d4d', '#ffcc00', '#00e5ff', '#00e676']
            }]
        };
        if (chartObj) chartObj.destroy();
        chartObj = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    } catch (e) {
        console.error('charts', e);
    }
}


async function logoutUser() {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('civic_current_user');
    localStorage.removeItem('civic_user_id');
    currentUserEmail = null;
    currentUserId = null;
    goto('userLogin');
}


function escapeHtml(str) {
    return (str || '').toString().replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    } [m]));
}


const translations = {
    en: {
        portalTitle: 'Futuristic Civic Portal',
        roleQuestion: '👤 Who are you?',
        roleInstruction: 'Choose role to continue',
        userButton: 'I am a User',
        adminButton: 'I am an Admin',
        userLoginTitle: '🔑 Sign in with Google',
        userLoginInstruction: "After signing in you'll be taken to the user portal",
        backButton: '← Back',
        adminLoginTitle: '🔐 Admin Login',
        adminIdPlaceholder: 'Admin ID',
        adminPassPlaceholder: 'Password',
        loginButton: 'Login',
        cancelButton: 'Cancel',
        adminLoginError: '❌ Incorrect ID or Password',
        reportIssueTitle: '⚡ Report an Issue',
        issueDescPlaceholder: 'Describe the issue...',
        selectCategoryPlaceholder: 'Select category',
        catElectricity: 'Electricity',
        catWater: 'Water',
        catStreetlight: 'Streetlight',
        catRoad: 'Road',
        catSanitation: 'Sanitation',
        locationLabel: '📍 Problem location',
        locationPlaceholder: 'Enter location manually',
        imageLabel: '📷 Image (upload or capture)',
        startCamBtn: 'Start Camera',
        removeImageBtn: 'Remove Image',
        takePhotoBtn: 'Take Photo',
        stopCamBtn: 'Stop Camera',
        videoLabel: '🎥 Video (upload or record)',
        startVidRec: 'Start Recording',
        stopVidRec: 'Stop Recording',
        removeVidBtn: 'Remove Video',
        audioLabel: '🎙 Audio (upload or record)',
        startAudRec: 'Start Recording',
        stopAudRec: 'Stop Recording',
        removeAudBtn: 'Remove Audio',
        submitReportBtn: 'Submit Report',
        logoutBtn: 'Logout',
        reportSuccessMsg: '✅ Report submitted successfully!',
        myReportsTitle: '📋 My Reports',
        adminDashboardTitle: '🛠 Admin Dashboard',
        analyticsTitle: '📊 Analytics',
        backToRoleBtn: 'Back to Role Select',
        loadingMessage: 'Loading...',
        signInToViewReports: 'Sign in to see your reports',
        statusLabel: 'Status',
        acceptBtn: 'Accept',
        inProgressBtn: 'In Progress',
        resolvedBtn: 'Resolved',
        deleteBtn: 'Delete',
        deleteConfirmation: 'Delete this report?',
        reportsCountLabel: 'Reports Count',
        signInFailedAlert: 'Google sign-in failed.',
        signInErrorAlert: 'Sign-in error',
        cameraErrorAlert: 'Could not access camera. Please check permissions.',
        videoRecorderErrorAlert: 'Could not access camera/microphone. Please check permissions.',
        audioRecorderErrorAlert: 'Could not access microphone. Please check permissions.',
        signInFirstAlert: 'Sign in first',
        fillRequiredFieldsAlert: 'Fill description, category, location',
        imageUploadFailedAlert: 'Image upload failed: ',
        videoUploadFailedAlert: 'Video upload failed: ',
        audioUploadFailedAlert: 'Audio upload failed: ',
        saveReportFailedAlert: 'Could not save report: ',
        failedToLoadReports: 'Failed to load reports',
        updateFailedAlert: 'Update failed: ',
        deleteFailedAlert: 'Delete failed: ',
        statusSubmitted: 'Submitted',
        statusAccepted: 'Accepted',
        statusInProgress: 'In Progress',
        statusResolved: 'Resolved'
    },
    hi: {
        portalTitle: 'भविष्यवादी नागरिक पोर्टल',
        roleQuestion: '👤 आप कौन हैं?',
        roleInstruction: 'जारी रखने के लिए भूमिका चुनें',
        userButton: 'मैं एक उपयोगकर्ता हूँ',
        adminButton: 'मैं एक प्रशासक हूँ',
        userLoginTitle: '🔑 गूगल से साइन इन करें',
        userLoginInstruction: 'साइन इन करने के बाद आपको उपयोगकर्ता पोर्टल पर ले जाया जाएगा',
        backButton: '← पीछे',
        adminLoginTitle: '🔐 प्रशासक लॉगिन',
        adminIdPlaceholder: 'प्रशासक आईडी',
        adminPassPlaceholder: 'पासवर्ड',
        loginButton: 'लॉगिन',
        cancelButton: 'रद्द करें',
        adminLoginError: '❌ गलत आईडी या पासवर्ड',
        reportIssueTitle: '⚡ एक समस्या की रिपोर्ट करें',
        issueDescPlaceholder: 'समस्या का वर्णन करें...',
        selectCategoryPlaceholder: 'श्रेणी चुनें',
        catElectricity: 'बिजली',
        catWater: 'पानी',
        catStreetlight: 'स्ट्रीटलाइट',
        catRoad: 'सड़क',
        catSanitation: 'स्वच्छता',
        locationLabel: '📍 समस्या का स्थान',
        locationPlaceholder: 'मैन्युअल रूप से स्थान दर्ज करें',
        imageLabel: '📷 छवि (अपलोड या कैप्चर करें)',
        startCamBtn: 'कैमरा शुरू करें',
        removeImageBtn: 'छवि हटाएँ',
        takePhotoBtn: 'फ़ोटो लें',
        stopCamBtn: 'कैमरा बंद करें',
        videoLabel: '🎥 वीडियो (अपलोड या रिकॉर्ड करें)',
        startVidRec: 'रिकॉर्डिंग शुरू करें',
        stopVidRec: 'रिकॉर्डिंग बंद करें',
        removeVidBtn: 'वीडियो हटाएँ',
        audioLabel: '🎙 ऑडियो (अपलोड या रिकॉर्ड करें)',
        startAudRec: 'रिकॉर्डिंग शुरू करें',
        stopAudRec: 'रिकॉर्डिंग बंद करें',
        removeAudBtn: 'ऑडियो हटाएँ',
        submitReportBtn: 'रिपोर्ट सबमिट करें',
        logoutBtn: 'लॉगआउट',
        reportSuccessMsg: '✅ रिपोर्ट सफलतापूर्वक सबमिट हो गई!',
        myReportsTitle: '📋 मेरी रिपोर्टें',
        adminDashboardTitle: '🛠 व्यवस्थापक डैशबोर्ड',
        analyticsTitle: '📊 विश्लेषण',
        backToRoleBtn: 'भूमिका चयन पर वापस जाएँ',
        loadingMessage: 'लोड हो रहा है...',
        signInToViewReports: 'अपनी रिपोर्ट देखने के लिए साइन इन करें',
        statusLabel: 'स्थिति',
        acceptBtn: 'स्वीकार करें',
        inProgressBtn: 'प्रगति में है',
        resolvedBtn: 'हल हो गया',
        deleteBtn: 'हटाएँ',
        deleteConfirmation: 'क्या इस रिपोर्ट को हटाना है?',
        reportsCountLabel: 'रिपोर्टों की संख्या',
        signInFailedAlert: 'गूगल साइन-इन विफल।',
        signInErrorAlert: 'साइन-इन त्रुटि',
        cameraErrorAlert: 'कैमरा तक नहीं पहुँचा जा सका। कृपया अनुमतियाँ जाँचें।',
        videoRecorderErrorAlert: 'कैमरा/माइक्रोफोन तक नहीं पहुँचा जा सका। कृपया अनुमतियाँ जाँचें।',
        audioRecorderErrorAlert: 'माइक्रोफोन तक नहीं पहुँचा जा सका। कृपया अनुमतियाँ जाँचें।',
        signInFirstAlert: 'पहले साइन इन करें',
        fillRequiredFieldsAlert: 'विवरण, श्रेणी, स्थान भरें',
        imageUploadFailedAlert: 'छवि अपलोड विफल: ',
        videoUploadFailedAlert: 'वीडियो अपलोड विफल: ',
        audioUploadFailedAlert: 'ऑडियो अपलोड विफल: ',
        saveReportFailedAlert: 'रिपोर्ट सहेजी नहीं जा सकी: ',
        failedToLoadReports: 'रिपोर्ट लोड करने में विफल रहा',
        updateFailedAlert: 'अपडेट विफल: ',
        deleteFailedAlert: 'हटाने में विफल: ',
        statusSubmitted: 'प्रस्तुत',
        statusAccepted: 'स्वीकृत',
        statusInProgress: 'प्रगति में',
        statusResolved: 'हल किया गया'
    },
    mr: {
        portalTitle: 'फ्युचरिस्टिक सिविक पोर्टल',
        roleQuestion: '👤 तुम्ही कोण आहात?',
        roleInstruction: 'पुढे जाण्यासाठी भूमिका निवडा',
        userButton: 'मी वापरकर्ता आहे',
        adminButton: 'मी प्रशासक आहे',
        userLoginTitle: '🔑 Google सह साइन इन करा',
        userLoginInstruction: 'साइन इन केल्यानंतर तुम्हाला वापरकर्ता पोर्टलवर नेले जाईल',
        backButton: '← मागे',
        adminLoginTitle: '🔐 ॲडमिन लॉगिन',
        adminIdPlaceholder: 'ॲडमिन आयडी',
        adminPassPlaceholder: 'पासवर्ड',
        loginButton: 'लॉगिन',
        cancelButton: 'रद्द करा',
        adminLoginError: '❌ चुकीचा आयडी किंवा पासवर्ड',
        reportIssueTitle: '⚡ समस्या नोंदवा',
        issueDescPlaceholder: 'समस्येचे वर्णन करा...',
        selectCategoryPlaceholder: 'श्रेणी निवडा',
        catElectricity: 'वीज',
        catWater: 'पाणी',
        catStreetlight: 'स्ट्रीटलाइट',
        catRoad: 'रस्ता',
        catSanitation: 'स्वच्छता',
        locationLabel: '📍 समस्येचे स्थान',
        locationPlaceholder: 'जागा मॅन्युअली प्रविष्ट करा',
        imageLabel: '📷 प्रतिमा (अपलोड किंवा कॅप्चर करा)',
        startCamBtn: 'कॅमेरा सुरू करा',
        removeImageBtn: 'प्रतिमा काढा',
        takePhotoBtn: 'फोटो घ्या',
        stopCamBtn: 'कॅमेरा बंद करा',
        videoLabel: '🎥 व्हिडिओ (अपलोड किंवा रेकॉर्ड करा)',
        startVidRec: 'रेकॉर्डिंग सुरू करा',
        stopVidRec: 'रेकॉर्डिंग बंद करा',
        removeVidBtn: 'व्हिडिओ काढा',
        audioLabel: '🎙 ऑडिओ (अपलोड किंवा रेकॉर्ड करा)',
        startAudRec: 'रेकॉर्डिंग सुरू करा',
        stopAudRec: 'रेकॉर्डिंग बंद करा',
        removeAudBtn: 'ऑडिओ काढा',
        submitReportBtn: 'रिपोर्ट सबमिट करा',
        logoutBtn: 'लॉगआउट',
        reportSuccessMsg: '✅ रिपोर्ट यशस्वीरित्या सबमिट झाली!',
        myReportsTitle: '📋 माझ्या रिपोर्ट',
        adminDashboardTitle: '🛠 ॲडमिन डॅशबोर्ड',
        analyticsTitle: '📊 विश्लेषण',
        backToRoleBtn: 'भूमिका निवडीवर परत जा',
        loadingMessage: 'लोड होत आहे...',
        signInToViewReports: 'तुमच्या रिपोर्ट पाहण्यासाठी साइन इन करा',
        statusLabel: 'स्थिती',
        acceptBtn: 'स्वीकारा',
        inProgressBtn: 'प्रगतीत आहे',
        resolvedBtn: 'सोडवले',
        deleteBtn: 'काढा',
        deleteConfirmation: 'ही रिपोर्ट काढायची आहे का?',
        reportsCountLabel: 'रिपोर्टची संख्या',
        signInFailedAlert: 'Google साइन-इन अयशस्वी.',
        signInErrorAlert: 'साइन-इन त्रुटी',
        cameraErrorAlert: 'कॅमेऱ्यात प्रवेश करता आला नाही. कृपया परवानग्या तपासा.',
        videoRecorderErrorAlert: 'कॅमेरा/मायक्रोफोनमध्ये प्रवेश करता आला नाही. कृपया परवानग्या तपासा.',
        audioRecorderErrorAlert: 'मायक्रोफोनमध्ये प्रवेश करता आला नाही. कृपया परवानग्या तपासा.',
        signInFirstAlert: 'आधी साइन इन करा',
        fillRequiredFieldsAlert: 'वर्णन, श्रेणी, स्थान भरा',
        imageUploadFailedAlert: 'प्रतिमा अपलोड अयशस्वी: ',
        videoUploadFailedAlert: 'व्हिडिओ अपलोड अयशस्वी: ',
        audioUploadFailedAlert: 'ऑडिओ अपलोड अयशस्वी: ',
        saveReportFailedAlert: 'रिपोर्ट सेव्ह करू शकलो नाही: ',
        failedToLoadReports: 'रिपोर्ट लोड करण्यात अयशस्वी',
        updateFailedAlert: 'अपडेट अयशस्वी: ',
        deleteFailedAlert: 'काढणे अयशस्वी: ',
        statusSubmitted: 'सबमिट केले',
        statusAccepted: 'स्वीकृत',
        statusInProgress: 'प्रगतीत',
        statusResolved: 'सोडवले'
    }
};

let currentLang = 'en';

function setLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang]').forEach(element => {
        const key = element.getAttribute('data-lang');
        if (translations[lang] && translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });
    document.querySelectorAll('[data-lang-placeholder]').forEach(element => {
        const key = element.getAttribute('data-lang-placeholder');
        if (translations[lang] && translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
    });
    // Update status labels in select and chart
    const categorySelect = document.getElementById('issueCat');
    const categoryOptions = categorySelect.getElementsByTagName('option');
    for (let i = 1; i < categoryOptions.length; i++) {
        const optionKey = categoryOptions[i].getAttribute('data-lang');
        if (translations[lang] && translations[lang][optionKey]) {
            categoryOptions[i].textContent = translations[lang][optionKey];
        }
    }
    // Re-render reports and charts to reflect language change
    if (!document.getElementById('page3').classList.contains('hidden')) renderUserReports();
    if (!document.getElementById('page4').classList.contains('hidden')) {
        renderAllReports();
        updateCharts();
    }
}


setLanguage(currentLang);