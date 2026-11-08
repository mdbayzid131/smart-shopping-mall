# 🐳 Closeté Backend - Docker Commands & Management Guide

এই গাইডে আপনার প্রজেক্টের (`Smart-Shopping-Mall`) দৈনন্দিন ব্যবহারের জন্য প্রয়োজনীয় সমস্ত গুরুত্বপূর্ণ ডকার কমান্ড একত্রিত করা হয়েছে।

---

## 🚀 ১. দৈনন্দিন শুরু ও বন্ধের কমান্ড (Quick Start)

| কাজ | কমান্ড | বিবরণ |
| :--- | :--- | :--- |
| **কন্টেইনার ব্যাকগ্রাউন্ডে চালু করা** | `docker compose up -d` | ব্যাকএন্ড এবং MongoDB ব্যাকগ্রাউন্ডে চালু করে। |
| **কোড পরিবর্তন করার পর রিবিল্ড** | `docker compose up -d --build` | নতুন কোড কম্পাইল করে কন্টেইনার আপডেট করে। |
| **সার্ভার বন্ধ করা** | `docker compose down` | চলমান কন্টেইনারগুলো বন্ধ করে দেয়। |
| **সার্ভার রিস্টার্ট করা** | `docker compose restart api` | শুধু ব্যাকএন্ড সার্ভিসটি দ্রুত রিস্টার্ট করে। |
| **সবকিছু রিস্টার্ট করা** | `docker compose restart` | ব্যাকএন্ড এবং ডাটাবেস দুটিই রিস্টার্ট করে। |

---

## 📊 ২. লগ এবং মনিটরিং (Logs & Status)

| কাজ | কমান্ড |
| :--- | :--- |
| **ব্যাকএন্ডের লাইভ লগ দেখতে** | `docker compose logs -f api` |
| **MongoDB-এর লাইভ লগ দেখতে** | `docker compose logs -f mongo` |
| **সব সার্ভিসের শেষ ৫০ লাইনের লগ** | `docker compose logs --tail=50 -f` |
| **চলমান কন্টেইনারগুলোর স্ট্যাটাস দেখা** | `docker ps` |
| **র‍্যাম ও সিপিইউ ব্যবহার (Live Stats)** | `docker stats` |

---

## 🛠️ ৩. কন্টেইনারের ভেতরে প্রবেশ (Exec & Debugging)

### ক. ব্যাকএন্ড কন্টেইনারের টার্মিনালে ঢুকতে:
```bash
docker compose exec api sh
```
*(বের হতে `exit` লিখে এন্টার দিন)*

### খ. MongoDB ডাটাবেস শেলে সরাসরি ঢুকতে:
```bash
docker compose exec mongo mongosh
```
*(MongoDB-এর ডাটা দেখতে: `show dbs;` বা `use smart-shopping-mall;`)*

---

## 💾 ৪. ডাটাবেস ব্যাকআপ ও রিস্টোর (Backup & Restore)

### ডাটাবেস ব্যাকআপ (Export) নিতে:
```bash
docker compose exec mongo mongodump --db smart-shopping-mall --out /data/db/backup
```

### ডাটাবেস রিস্টোর (Import) করতে:
```bash
docker compose exec mongo mongorestore --db smart-shopping-mall /data/db/backup/smart-shopping-mall
```

---

## 🧹 ৫. ডকার ক্লিনআপ ও ডিস্ক স্পেস খালি করা (Cleanup)

| কাজ | কমান্ড | সতর্কতা |
| :--- | :--- | :--- |
| **অব্যবহৃত পুরনো ইমেজ মুছে ফেলা** | `docker image prune -f` | নিরাপদ (অব্যবহৃত ক্যাশ রিমুভ করে) |
| **সম্পূর্ণ ক্লিনআপ** | `docker system prune -f` | বন্ধ থাকা সব টেম্পোরারি কন্টেইনার ক্লিন করে |
| **ডাটাবেস সহ সম্পূর্ণ রিসেট** | `docker compose down -v` | ⚠️ **সতর্কতা:** ডাটাবেসের সমস্ত ডাটা ডিলিট হয়ে যাবে! |

---

## 🌐 ৬. ক্লাউড বা VPS সার্ভারে ডিপ্লয়মেন্ট (Production Deployment)

আপনার লোকাল পিসি ছাড়া ডিজিটালওশান (DigitalOcean), এডাব্লিউএস (AWS) বা যেকোনো উবুন্টু ভিপিএস সার্ভারে প্রজেক্ট লাইভ করার নিয়ম:

1. সার্ভারে গিট থেকে কোড ক্লোন করুন:
   ```bash
   git clone <your-repo-url>
   cd Smart-Shopping-Mall
   ```
2. আপনার প্রোডাকশন `.env` ফাইলটি তৈরি করুন:
   ```bash
   nano .env
   ```
3. ডকার দিয়ে মাত্র একটি কমান্ডে সম্পূর্ণ ব্যাকএন্ড লাইভ করুন:
   ```bash
   docker compose up -d --build
   ```
*(সার্ভারে আলাদা করে Node.js বা MongoDB ইনস্টল করার কোনো প্রয়োজন নেই, ডকার নিজেই সবকিছু পরিচালনা করবে।)*
