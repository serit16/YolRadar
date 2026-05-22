# YolRadar Geliştirme Planı

## Grup 1 — Harita İyileştirmeleri
- [x] GPS Accuracy Circle
- [x] Hız limiti göstergesi (OSM Nominatim reverse geocode)
- [x] locationfound debounce/throttle
- [x] Hotspot heatmap (admin)

## Grup 2 — Sosyal Özellikler  
- [x] "Ben de gördüm" UI iyileştirmesi
- [x] Yorum/not sistemi (marker popup)
- [x] Rozet sistemi (profil)
- [x] WhatsApp paylaş butonu

## Grup 3 — Navigasyon
- [x] Alternatif rota seçim UI
- [x] Sesli talimat iyileştirmesi

## Grup 4 — Teknik Borç
- [x] XSS sanitization
- [x] Firebase Security Rules
- [x] Input debounce

## Notlar
- Hız limiti: Nominatim'den OSM maxspeed verisi, yoksa "—" göster
- Rozet: 5/25/100/500 ihbar milestone'ları + skor bazlı
- Hotspot: Admin panelde en çok ihbar olan 10 koordinat kümesi
