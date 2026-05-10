"use client";

import { useState, useEffect } from "react";
import { ReactReader, ReactReaderStyle } from "react-reader";
import { Moon, Sun, Bookmark, Menu, ChevronLeft } from "lucide-react";

export default function Home() {
  // --- CORE STATE ---
  const [mounted, setMounted] = useState(false);
  const [location, setLocation] = useState<string | number>(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState(110);
  const [fontFamily, setFontFamily] = useState("Georgia, serif");
  
  // --- ENGINE STATE ---
  const [rendition, setRendition] = useState<any>(null);
  const [book, setBook] = useState<any>(null);
  const [toc, setToc] = useState<any[]>([]);
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [chapterName, setChapterName] = useState("Reading...");
  
  // --- UI STATE ---
  const [showUI, setShowUI] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'toc' | 'bookmarks'>('toc');
  const [showFontPanel, setShowFontPanel] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [sliderValue, setSliderValue] = useState(0);
  const [historyCfi, setHistoryCfi] = useState<string | null>(null);

  // --- BOOT UP & HYDRATION ---
  useEffect(() => {
    setMounted(true);
    const savedLoc = localStorage.getItem("reader-loc");
    if (savedLoc) setLocation(savedLoc);
    if (localStorage.getItem("reader-theme") === "dark") setIsDarkMode(true);
    const savedFont = localStorage.getItem("reader-font");
    if (savedFont) setFontSize(parseInt(savedFont));
    const savedFamily = localStorage.getItem("reader-family");
    if (savedFamily) setFontFamily(savedFamily);
    const savedBookmarks = localStorage.getItem("reader-bookmarks");
    if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
  }, []);

  // --- ENGINE SETUP & THEMES ---
  useEffect(() => {
    if (rendition) {
      // Clean, padding-free themes. The container handles the spacing now!
      rendition.themes.register("light", { body: { background: "transparent", color: "#111827" }, "::selection": { background: "rgba(217, 119, 6, 0.2)" }});
      rendition.themes.register("dark", { body: { background: "transparent", color: "#f3f4f6" }, "::selection": { background: "rgba(251, 191, 36, 0.3)" }});
      rendition.themes.select(isDarkMode ? "dark" : "light");
      rendition.themes.fontSize(`${fontSize}%`);
      rendition.themes.font(fontFamily);

      rendition.on("selected", (cfiRange: string) => {
        triggerHaptic("light");
        rendition.book.getRange(cfiRange).then((range: any) => {
          const text = range.toString().trim();
          if (text) {
            navigator.clipboard.writeText(`"${text}"`);
            showToast("📋 Copied to Clipboard!");
          }
        });
      });

      rendition.on("click", (e: any) => {
        const width = window.innerWidth;
        const x = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
        if (!x) return;
        if (x < width * 0.25) { triggerHaptic("light"); rendition.prev(); }
        else if (x > width * 0.75) { triggerHaptic("light"); rendition.next(); }
        else { setShowUI(prev => !prev); setShowFontPanel(false); }
      });
    }
  }, [rendition, isDarkMode, fontSize, fontFamily]);

  // --- BOOK DATA PROCESSING ---
  useEffect(() => {
    if (book) {
      book.loaded.navigation.then((nav: any) => setToc(nav.toc || nav));
      book.loaded.cover.then((cover: any) => {
        if (cover) book.archive.createUrl(cover).then((url: string) => setCoverUrl(url));
      });

      let charsPerPage = Math.max(500, Math.round(1600 * (100 / fontSize)));
      book.locations.generate(charsPerPage).then((locations: any) => {
        setTotalPages(locations.length);
        if (rendition && rendition.location && rendition.location.start) {
            updateProgressData(rendition.location.start.cfi);
        }
      });
    }
  }, [book, fontSize]);

  const updateProgressData = (cfi: string) => {
      if (book && book.locations.length() > 0) {
          const pg = book.locations.locationFromCfi(cfi);
          setCurrentPage(pg);
          const percent = book.locations.percentageFromCfi(cfi);
          setPercentage(Math.round(percent * 100));
          setSliderValue(percent * 100);
      }
      
      // Robust Chapter Name Lookup
      if (book) {
          const spineItem = book.spine.get(cfi);
          if (spineItem) {
              const navItem = book.navigation.get(spineItem.href);
              if (navItem && navItem.label) {
                  setChapterName(navItem.label.trim());
              } else {
                  setChapterName(`Section ${spineItem.index + 1}`);
              }
          }
      }
  };

  const locationChanged = (epubcifi: string) => {
    setLocation(epubcifi);
    localStorage.setItem("reader-loc", epubcifi);
    updateProgressData(epubcifi);
  };

  // --- ACTIONS & UTILS ---
  const triggerHaptic = (type = "light") => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(type === "heavy" ? 30 : 10);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2000);
  };

  const saveHistory = () => {
    if (rendition && rendition.location && rendition.location.start) setHistoryCfi(rendition.location.start.cfi);
  };

  const handleSliderChange = (e: any) => {
    triggerHaptic("light");
    const val = parseFloat(e.target.value);
    setSliderValue(val);
    if (book && book.locations.length() > 0) {
        const p = val / 100;
        const targetCfi = book.locations.cfiFromPercentage(p);
        saveHistory();
        setLocation(targetCfi);
    }
  };

  const toggleBookmark = () => {
    triggerHaptic("heavy");
    if (typeof location !== 'string') return;
    let newBookmarks = [...bookmarks];
    const exists = newBookmarks.find(b => b.cfi === location);
    
    if (exists) {
      newBookmarks = newBookmarks.filter(b => b.cfi !== location);
      showToast("Bookmark Removed");
    } else {
      const safeName = chapterName === "Loading..." || !chapterName ? `Page ${currentPage}` : chapterName;
      newBookmarks.push({ cfi: location, name: safeName, preview: new Date().toLocaleDateString() });
      showToast("🔖 Bookmark Saved");
    }
    setBookmarks(newBookmarks);
    localStorage.setItem("reader-bookmarks", JSON.stringify(newBookmarks));
  };

  const goToBookmark = (cfi: string) => { saveHistory(); setLocation(cfi); setSidebarOpen(false); };

  // --- DISABLE DEFAULT UI (Correct TypeScript syntax) ---
  const ownStyles = {
    ...ReactReaderStyle,
    readerArea: { ...ReactReaderStyle.readerArea, backgroundColor: 'transparent' },
    tocArea: { display: 'none' }, 
    tocButton: { display: 'none' }, 
    titleArea: { display: 'none' } 
  };

  if (!mounted) return null;

  const isBookmarked = typeof location === 'string' && bookmarks.some(b => b.cfi === location);
  const timeMinsLeft = Math.max(1, Math.round((totalPages - currentPage) * 1.2));
  const timeLeftDisplay = timeMinsLeft > 60 ? `${Math.round(timeMinsLeft/60)} hrs left` : `${timeMinsLeft} mins left`;

  return (
    <div className={`relative h-[100dvh] w-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? "bg-[#121212] text-gray-200" : "bg-white text-gray-900"}`}>
      
      <style dangerouslySetInnerHTML={{__html: `* { touch-action: manipulation; }`}} />

      {/* TOAST */}
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-gray-900 text-white font-bold text-sm shadow-xl transition-all duration-300 z-[200] ${toastMsg ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"}`}>
        {toastMsg}
      </div>

      {/* CUSTOM OVERLAY & SIDEBAR */}
      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] transition-opacity duration-300 ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={() => setSidebarOpen(false)}></div>
      <div className={`fixed top-0 left-0 h-full w-80 shadow-2xl z-[110] transform transition-transform duration-300 flex flex-col ${isDarkMode ? "bg-gray-900 border-r border-gray-800" : "bg-white border-r border-gray-200"} ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className={`flex border-b ${isDarkMode ? "border-gray-800" : "border-gray-200"}`}>
            <button onClick={() => setSidebarTab('toc')} className={`flex-1 py-4 font-bold text-sm transition-colors ${sidebarTab === 'toc' ? "text-amber-500 border-b-2 border-amber-500" : "text-gray-400"}`}>Index</button>
            <button onClick={() => setSidebarTab('bookmarks')} className={`flex-1 py-4 font-bold text-sm transition-colors ${sidebarTab === 'bookmarks' ? "text-amber-500 border-b-2 border-amber-500" : "text-gray-400"}`}>Bookmarks</button>
        </div>
        <div className="flex-1 overflow-y-auto">
            {sidebarTab === 'toc' && (
                <ul className="py-2">
                    {toc.map((item, i) => (
                        <li key={i}>
                            <button onClick={() => { saveHistory(); setLocation(item.href); setSidebarOpen(false); }} className={`w-full text-left px-6 py-4 text-sm font-medium border-b ${isDarkMode ? "border-gray-800 hover:bg-gray-800" : "border-gray-100 hover:bg-gray-50"}`}>
                                {item.label.trim()}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {sidebarTab === 'bookmarks' && (
                <ul className="py-2">
                    {bookmarks.length === 0 ? <li className="text-center p-6 text-gray-500 text-sm">No bookmarks yet.</li> : bookmarks.map((bm, i) => (
                        <li key={i} className={`flex justify-between items-center px-6 py-4 border-b ${isDarkMode ? "border-gray-800" : "border-gray-100"}`}>
                            <div className="flex-1 cursor-pointer" onClick={() => goToBookmark(bm.cfi)}>
                                <div className="font-bold text-sm">{bm.name}</div>
                                <div className="text-xs text-gray-500 mt-1">Saved on {bm.preview}</div>
                            </div>
                            <button onClick={() => {
                                const newBms = bookmarks.filter((_, idx) => idx !== i);
                                setBookmarks(newBms);
                                localStorage.setItem("reader-bookmarks", JSON.stringify(newBms));
                            }} className="text-red-500 p-2 text-lg">✕</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
      </div>

      {/* TOP NAVIGATION */}
      <div className={`absolute top-0 left-0 w-full h-16 px-4 flex justify-between items-center z-50 transition-transform duration-300 ${isDarkMode ? "bg-[#121212]/90 border-b border-gray-800" : "bg-white/90 border-b border-gray-200"} backdrop-blur-md ${showUI ? "translate-y-0" : "-translate-y-full"}`}>
        <button onClick={() => { triggerHaptic(); setSidebarOpen(true); }} className="p-2 rounded-full hover:bg-gray-500/10">
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-1">
          <button onClick={toggleBookmark} className="p-2 rounded-full hover:bg-gray-500/10">
            <Bookmark className={`w-5 h-5 transition-colors ${isBookmarked ? "fill-amber-500 text-amber-500" : ""}`} />
          </button>
          <button onClick={() => setShowFontPanel(!showFontPanel)} className="p-2 rounded-full hover:bg-gray-500/10 font-bold text-lg leading-none">Aa</button>
          <button onClick={() => { setIsDarkMode(!isDarkMode); localStorage.setItem("reader-theme", !isDarkMode ? "dark" : "light"); }} className="p-2 rounded-full hover:bg-gray-500/10">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* FONT DROPDOWN PANEL */}
      <div className={`absolute top-16 right-4 w-64 p-4 rounded-2xl shadow-2xl z-[60] transition-all duration-200 ${isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"} ${showFontPanel && showUI ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-4 pointer-events-none"}`}>
          <div className="flex justify-between gap-2 mb-3">
              <button onClick={() => { setFontSize(Math.max(80, fontSize - 10)); localStorage.setItem("reader-font", String(Math.max(80, fontSize - 10))); }} className={`flex-1 py-2 rounded-lg font-bold ${isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"}`}>A-</button>
              <button onClick={() => { setFontSize(Math.min(200, fontSize + 10)); localStorage.setItem("reader-font", String(Math.min(200, fontSize + 10))); }} className={`flex-1 py-2 rounded-lg font-bold text-lg ${isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"}`}>A+</button>
          </div>
          <div className="flex justify-between gap-2">
              <button onClick={() => { setFontFamily("Georgia, serif"); localStorage.setItem("reader-family", "Georgia, serif"); }} className={`flex-1 py-2 rounded-lg font-serif ${fontFamily.includes("serif") ? "bg-amber-500 text-white" : isDarkMode ? "bg-gray-700" : "bg-gray-100"}`}>Serif</button>
              <button onClick={() => { setFontFamily("-apple-system, sans-serif"); localStorage.setItem("reader-family", "-apple-system, sans-serif"); }} className={`flex-1 py-2 rounded-lg font-sans ${!fontFamily.includes("serif") ? "bg-amber-500 text-white" : isDarkMode ? "bg-gray-700" : "bg-gray-100"}`}>Sans</button>
          </div>
      </div>

      {/* CORE READING ENGINE - CONSTRAINED BY CSS, NOT PADDING */}
      <div className="absolute top-16 bottom-[140px] left-0 right-0 z-10 px-4">
        <ReactReader
          url="/book.epub"
          location={location}
          locationChanged={locationChanged}
          swipeable={true}
          readerStyles={ownStyles}
          getRendition={(rend) => { setRendition(rend); setBook(rend.book); }}
          epubOptions={{ flow: "paginated", manager: "continuous" }}
        />
      </div>

      {/* LIBBY-STYLE BOTTOM UI */}
      <div className={`absolute bottom-0 left-0 w-full pt-4 pb-6 px-6 z-50 transition-transform duration-300 ${isDarkMode ? "bg-[#121212]/95 border-t border-gray-800" : "bg-white/95 border-t border-gray-200"} backdrop-blur-xl ${showUI ? "translate-y-0" : "translate-y-full"}`}>
        
        {/* Cover Art & Page Readout */}
        <div className="relative flex justify-between items-center mb-4">
            <div className={`absolute top-1/2 left-0 w-full h-px -translate-y-1/2 ${isDarkMode ? "bg-gray-800" : "bg-gray-200"} -z-10`}></div>
            {/* Added Percentage Back Here */}
            <span className="font-bold text-xs px-2 bg-inherit">pg. {currentPage || "--"} ({percentage}%)</span>
            <div className={`w-12 h-12 rounded-full overflow-hidden border-2 shadow-md ${isDarkMode ? "border-gray-900 bg-gray-800" : "border-white bg-gray-100"}`}>
                {coverUrl ? <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" /> : null}
            </div>
            <span className="font-bold text-xs px-2 bg-inherit">of {totalPages || "--"}</span>
        </div>

        {/* Chapter Title */}
        <div className="text-center mb-2">
            <h2 className="font-bold text-sm truncate px-4">{chapterName}</h2>
            <button onClick={() => setSidebarOpen(true)} className={`text-[10px] tracking-widest uppercase font-bold mt-1 ${isDarkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}>Table of Contents</button>
        </div>

        {/* Ruler Scrubber */}
        <div className="relative w-full h-10 flex items-center max-w-2xl mx-auto mb-2">
            <input 
                type="range" min="0" max="100" step="0.1" 
                value={sliderValue || 0} 
                onChange={handleSliderChange}
                disabled={!totalPages}
                className="w-full h-6 appearance-none bg-transparent cursor-pointer relative z-10"
                style={{
                    backgroundImage: `repeating-linear-gradient(90deg, ${isDarkMode ? '#333' : '#e5e5e5'}, ${isDarkMode ? '#333' : '#e5e5e5'} 1px, transparent 1px, transparent 8px)`,
                    backgroundPosition: 'center', backgroundSize: '100% 60%', backgroundRepeat: 'no-repeat'
                }}
            />
            <style dangerouslySetInnerHTML={{__html: `
                input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 4px; height: 35px; border-radius: 2px; background: ${isDarkMode ? '#fff' : '#111'}; cursor: pointer; box-shadow: 0 0 5px rgba(0,0,0,0.3); }
            `}} />
        </div>

        {/* Bottom Actions (Ghost Button & Time) */}
        <div className="flex justify-between items-center max-w-2xl mx-auto px-2">
            <button 
                onClick={() => { if(historyCfi) { triggerHaptic(); setLocation(historyCfi); setHistoryCfi(null); }}} 
                className={`flex items-center gap-1 font-bold text-xs transition-opacity ${historyCfi ? "opacity-100 cursor-pointer" : "opacity-0 pointer-events-none"} ${isDarkMode ? "text-amber-500" : "text-amber-600"}`}
            >
                <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <span className={`font-bold text-xs ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                {totalPages ? timeLeftDisplay : "..."}
            </span>
        </div>
      </div> 
    </div>
  );
}