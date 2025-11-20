import "./styles.css";
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Printer, Trash2, History, Volume2, ArrowRight, Box, CheckCircle2, FileSpreadsheet } from 'lucide-react';

export default function SmartLabelApp() {
  // --- Cấu hình State ---
  const [isListening, setIsListening] = useState(false);
  const [startSequence, setStartSequence] = useState(1000); 
  const [dimensions, setDimensions] = useState(['', '', '', '']); 
  const labels = ['Label 1', 'Label 2', 'Label 3', 'Label 4'];
  
  const [logs, setLogs] = useState([]);
  const [printedBatches, setPrintedBatches] = useState([]);
  const [lastPrinted, setLastPrinted] = useState(null);
  
  const recognitionRef = useRef(null);

  // --- TỰ ĐỘNG IN KHI ĐỦ 4 SỐ ---
  useEffect(() => {
    const filledCount = dimensions.filter(d => d !== '').length;
    if (filledCount === 4) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [dimensions]);

  // --- Cài đặt Nhận diện giọng nói (Tiếng Việt) ---
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'vi-VN'; 

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        processVoiceInput(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        if (event.error === 'no-speech') return;
        addLog(`Lỗi Mic: ${event.error}`, 'error');
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        if (isListening) recognitionRef.current.start();
      };
    }
  }, [isListening]);

  // --- Xử lý Logic chính ---
  const processVoiceInput = (text) => {
    if (text.includes('in') || text.includes('print') || text.includes('xong') || text.includes('ok')) {
      handlePrint();
      return;
    }

    if (text.includes('xóa') || text.includes('lại') || text.includes('hủy') || text.includes('reset')) {
      setDimensions(['', '', '', '']);
      addLog('Đã xóa dữ liệu.', 'warning');
      return;
    }

    const numberRegex = /(\d+([.,]\d+)?)/;
    const match = text.match(numberRegex);

    if (match) {
      const normalizedNum = match[0].replace(',', '.');
      const hasEmptySlot = dimensions.some(d => d === '');
      if (hasEmptySlot) {
          fillNextSlot(normalizedNum);
      }
    }
  };

  const fillNextSlot = (value) => {
    setDimensions(prev => {
      const emptyIndex = prev.findIndex(val => val === '');
      
      if (emptyIndex !== -1) {
        const newDims = [...prev];
        newDims[emptyIndex] = value;
        
        const currentSTT = startSequence + emptyIndex;
        
        if (emptyIndex === 3) {
          addLog(`Đã nhập số cuối: ${value}. Đang tự động in...`, 'success');
        } else {
          addLog(`Đã nhập ${labels[emptyIndex]} (#${currentSTT}): ${value}`, 'info');
        }
        return newDims;
      } else {
        return prev;
      }
    });
  };

  const handlePrint = () => {
    const filledCount = dimensions.filter(d => d !== '').length;
    if (filledCount < 4) {
      addLog(`Thiếu dữ liệu! Mới có ${filledCount}/4.`, 'error');
      return;
    }

    const batchData = {
      id: Date.now(),
      start: startSequence,
      end: startSequence + 3,
      dims: [...dimensions],
      time: new Date().toLocaleTimeString()
    };

    setPrintedBatches(prev => [batchData, ...prev]);
    setLastPrinted(batchData);
    setTimeout(() => setLastPrinted(null), 3000);

    addLog(`Đang in lô: #${startSequence} -> #${startSequence + 3}`, 'success');

    setStartSequence(prev => prev + 4);
    setDimensions(['', '', '', '']);
  };

  // --- XUẤT EXCEL (CSV CHI TIẾT) ---
  const exportToExcel = () => {
    if (printedBatches.length === 0) {
      alert("Chưa có dữ liệu để xuất!");
      return;
    }

    // Tạo header + BOM (\uFEFF) để Excel hiển thị đúng tiếng Việt
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Thoi Gian,Batch ID,So Thu Tu (Barcode),Ten Nhan (Label),So Do\n";

    // Thêm dữ liệu chi tiết
    printedBatches.forEach(batch => {
      // Lặp qua 4 kích thước trong lô để tạo 4 dòng riêng
      batch.dims.forEach((dim, index) => {
        const currentSTT = batch.start + index;
        const currentLabel = labels[index];
        
        // Xác định đơn vị (nếu muốn ghi vào file)
        const unit = index === 3 ? "kg" : "cm"; // Ví dụ logic đơn vị
        const valueWithUnit = `${dim}`; // Hoặc `${dim} ${unit}` nếu muốn kèm đơn vị

        const rowData = [
          batch.time,
          batch.id,
          currentSTT,
          currentLabel,
          valueWithUnit
        ].join(",");
        csvContent += rowData + "\n";
      });
    });

    // Tải file
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ChiTiet_SoDo_" + new Date().toISOString().slice(0,10) + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addLog("Đã tải file Excel chi tiết xuống máy.", "success");
  };

  // --- Utilities ---
  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert('Trình duyệt không hỗ trợ Web Speech API.');
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      addLog('Mic đang bật. Mời đọc số...', 'info');
    }
  };

  const addLog = (msg, type = 'info') => {
    const colorMap = {
      info: 'text-slate-300',
      success: 'text-emerald-400',
      warning: 'text-yellow-400',
      error: 'text-red-400'
    };
    setLogs(prev => [{ msg, type, color: colorMap[type], time: new Date().toLocaleTimeString().slice(0,5) }, ...prev]);
  };

  const simulate = (txt) => processVoiceInput(txt);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500 selection:text-white pb-24">
      
      {/* --- HEADER --- */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg shadow-blue-900/20 shadow-lg">
              <Printer size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm md:text-base leading-tight text-slate-100">Smart Print QC</h1>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></div>
                <p className="text-[10px] text-slate-400">{isListening ? 'Đang hoạt động' : 'Sẵn sàng'}</p>
              </div>
            </div>
          </div>
          
          <div className="text-right bg-slate-800/50 px-3 py-1 rounded-lg border border-slate-700">
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Dải số tiếp theo</div>
            <div className="text-lg font-mono font-bold text-yellow-400 flex items-center justify-end gap-1">
              #{startSequence} <ArrowRight size={12} className="text-slate-600"/> #{startSequence+3}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">

        {/* --- MAIN INPUT AREA (4 SLOTS) --- */}
        <div className="bg-slate-900 rounded-2xl p-2 border border-slate-800 shadow-inner">
          <div className="grid grid-cols-2 gap-2">
            {labels.map((label, idx) => {
              const isFilled = dimensions[idx] !== '';
              const isActive = !isFilled && idx === dimensions.findIndex(d => d === '');
              const currentSTT = startSequence + idx;

              return (
                <div 
                  key={idx} 
                  className={`relative aspect-[1.5/1] rounded-xl border flex flex-col items-center justify-center transition-all duration-300 ${
                    isFilled 
                      ? 'bg-emerald-900/20 border-emerald-500/50 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]' 
                      : isActive 
                        ? 'bg-slate-800 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)] scale-[1.02] z-10' 
                        : 'bg-slate-900 border-slate-800 opacity-60'
                  }`}
                >
                  <div className={`absolute top-2 left-2 text-[9px] font-mono px-1.5 py-0.5 rounded ${isFilled ? 'bg-emerald-500 text-black font-bold' : 'bg-slate-700 text-slate-400'}`}>
                    #{currentSTT}
                  </div>
                  
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5 font-bold">{label}</span>
                  <span className={`text-2xl md:text-3xl font-bold tracking-tight ${isFilled ? 'text-emerald-400' : isActive ? 'text-blue-400 animate-pulse' : 'text-slate-600'}`}>
                    {dimensions[idx] || '--'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* --- CONTROL BUTTONS --- */}
        <div className="flex gap-3">
          <button
            onClick={toggleMic}
            className={`flex-1 py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${
              isListening 
                ? 'bg-red-500 text-white ring-4 ring-red-500/20 animate-pulse' 
                : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98]'
            }`}
          >
            {isListening ? <><Mic className="animate-bounce" /> Đang nghe...</> : <><MicOff /> Bắt đầu đọc</>}
          </button>

          <button
            onClick={() => setDimensions(['','','',''])}
            className="px-4 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-red-400 border border-slate-700 transition-colors active:scale-95"
            title="Xóa làm lại"
          >
            <Trash2 size={24} />
          </button>
        </div>

        {/* --- SIMULATION TOOLS --- */}
        <div className="bg-slate-900/30 rounded-xl p-3 border border-slate-800/50">
          <div className="flex items-center gap-2 mb-2">
             <Volume2 size={12} className="text-slate-500"/>
             <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Giả lập giọng nói (Test)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[12, 25.5, 30, 5.2].map(n => (
              <button key={n} onClick={() => simulate(n.toString())} className="bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg text-xs font-mono text-slate-300 border border-slate-700 transition-colors">
                "{n}"
              </button>
            ))}
          </div>
        </div>

        {/* --- HISTORY LIST & EXPORT --- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-400 flex items-center gap-2"><History size={14}/> Lịch sử in gần đây</h3>
            
            {/* NÚT XUẤT EXCEL */}
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors shadow-sm"
            >
              <FileSpreadsheet size={12}/> Xuất Excel Chi Tiết
            </button>
          </div>
          
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden h-[200px] flex flex-col">
            {printedBatches.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-700 gap-2">
                <Box size={40} strokeWidth={1.5} />
                <span className="text-xs">Chưa có dữ liệu</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {printedBatches.map((batch, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50 hover:border-slate-600 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20">
                          Lô #{batch.start}
                        </div>
                        <ArrowRight size={10} className="text-slate-600"/>
                        <div className="text-[10px] text-slate-400">#{batch.end}</div>
                      </div>
                      <span className="text-[9px] text-slate-600 font-mono">{batch.time}</span>
                    </div>
                    <div className="flex gap-1">
                      {batch.dims.map((d, idx) => (
                        <div key={idx} className="flex-1 bg-white/90 text-black p-1 rounded-[2px] text-[8px] text-center shadow-sm">
                          <div className="font-bold border-b border-black/10 mb-0.5">#{batch.start + idx}</div>
                          <div className="font-mono font-semibold">{d}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- LOGS --- */}
        <div className="bg-black/80 rounded-lg p-2 h-20 overflow-y-auto font-mono text-[9px] border border-slate-800 text-slate-400">
          {logs.map((log, i) => (
            <div key={i} className={`${log.color} mb-0.5`}>
              <span className="text-slate-700 mr-1">[{log.time}]</span>
              {log.msg}
            </div>
          ))}
        </div>

      </div>

      {/* --- POPUP --- */}
      {lastPrinted && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-10 fade-in duration-300 z-50">
          <div className="bg-white/20 p-2 rounded-full">
             <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="font-bold text-sm">Đã gửi lệnh in thành công!</div>
            <div className="text-xs opacity-90">Tiếp theo: <span className="font-mono font-bold text-yellow-300">#{lastPrinted.end + 1}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
export default function App() {
  return (
    <div className="App">
      <h1>Hello CodeSandbox</h1>
      <h2>Start editing to see some magic happen!</h2>
    </div>
  );
}
