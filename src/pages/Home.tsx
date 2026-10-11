export default function Home() {
  return null;
}

// Placeholder for episode sort popover UI in real file.
// In the actual component (in the real project), the episode sort
// control would be:
//
// <div className="mb-2 rounded-lg border border-white/20 bg-black/30 px-3 py-1.5 text-xs">
//   <div className="flex items-center justify-between">
//     <span className="font-semibold text-white/85">Urutkan episode</span>
//     <div className="flex gap-1">
//       {[
//         { value: "newest-ep", label: "Episode terbaru" },
//         { value: "oldest-ep", label: "Episode terlama" },
//         { value: "newest-date", label: "Tanggal terbaru" },
//         { value: "oldest-date", label: "Tanggal terlama" },
//       ].map(({ value, label }) => (
//         <button
//           key={value}
//           onClick={() => setEpisodeOrder(
//             episodeOrder === value ? "newest-ep" : value,
//           )}
//           className={cn(
//             "rounded border px-2.5 py-1 text-[11px] font-semibold transition",
//             episodeOrder === value
//               ? "border-white/40 bg-white/20 text-white"
//               : "border-white/15 text-white/60 hover:border-white/30",
//           )}
//         >
//           {label}
//         </button>
//       ))}
//     </div>
//   </div>
// </div>
//
// State declaration in component:
//   const [episodeOrder, setEpisodeOrder] = useState<
//     "newest-ep" | "oldest-ep" | "newest-date" | "oldest-date"
//   >("newest-ep");
//
// Sorting logic uses episodeOrder to pick sort comparator; date sorting
// will be driven by episode releasedAt field if present on the episode
// objects in that project's detail model.
