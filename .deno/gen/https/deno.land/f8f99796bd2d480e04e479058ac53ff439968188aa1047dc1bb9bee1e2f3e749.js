// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
import { getStringWidth } from "./util/inspect.mjs";
// The use of Unicode characters below is the only non-comment use of non-ASCII
// Unicode characters in Node.js built-in modules. If they are ever removed or
// rewritten with \u escapes, then a test will need to be (re-)added to Node.js
// core to verify that Unicode characters work in built-ins.
// Refs: https://github.com/nodejs/node/issues/10673
const tableChars = {
    middleMiddle: "─",
    rowMiddle: "┼",
    topRight: "┐",
    topLeft: "┌",
    leftMiddle: "├",
    topMiddle: "┬",
    bottomRight: "┘",
    bottomLeft: "└",
    bottomMiddle: "┴",
    rightMiddle: "┤",
    left: "│ ",
    right: " │",
    middle: " │ "
};
const renderRow = (row, columnWidths)=>{
    let out = tableChars.left;
    for(let i = 0; i < row.length; i++){
        const cell = row[i];
        const len = getStringWidth(cell);
        const needed = (columnWidths[i] - len) / 2;
        // round(needed) + ceil(needed) will always add up to the amount
        // of spaces we need while also left justifying the output.
        out += " ".repeat(needed) + cell + " ".repeat(Math.ceil(needed));
        if (i !== row.length - 1) {
            out += tableChars.middle;
        }
    }
    out += tableChars.right;
    return out;
};
const table = (head, columns)=>{
    const rows = [];
    const columnWidths = head.map((h)=>getStringWidth(h));
    const longestColumn = Math.max(...columns.map((a)=>a.length));
    for(let i = 0; i < head.length; i++){
        const column = columns[i];
        for(let j = 0; j < longestColumn; j++){
            if (rows[j] === undefined) {
                rows[j] = [];
            }
            const value = rows[j][i] = Object.hasOwn(column, j) ? column[j] : "";
            const width = columnWidths[i] || 0;
            const counted = getStringWidth(value);
            columnWidths[i] = Math.max(width, counted);
        }
    }
    const divider = columnWidths.map((i)=>tableChars.middleMiddle.repeat(i + 2));
    let result = tableChars.topLeft + divider.join(tableChars.topMiddle) + tableChars.topRight + "\n" + renderRow(head, columnWidths) + "\n" + tableChars.leftMiddle + divider.join(tableChars.rowMiddle) + tableChars.rightMiddle + "\n";
    for (const row of rows){
        result += `${renderRow(row, columnWidths)}\n`;
    }
    result += tableChars.bottomLeft + divider.join(tableChars.bottomMiddle) + tableChars.bottomRight;
    return result;
};
export default table;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvY2xpX3RhYmxlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50IGFuZCBOb2RlIGNvbnRyaWJ1dG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5cbmltcG9ydCB7IGdldFN0cmluZ1dpZHRoIH0gZnJvbSBcIi4vdXRpbC9pbnNwZWN0Lm1qc1wiO1xuXG4vLyBUaGUgdXNlIG9mIFVuaWNvZGUgY2hhcmFjdGVycyBiZWxvdyBpcyB0aGUgb25seSBub24tY29tbWVudCB1c2Ugb2Ygbm9uLUFTQ0lJXG4vLyBVbmljb2RlIGNoYXJhY3RlcnMgaW4gTm9kZS5qcyBidWlsdC1pbiBtb2R1bGVzLiBJZiB0aGV5IGFyZSBldmVyIHJlbW92ZWQgb3Jcbi8vIHJld3JpdHRlbiB3aXRoIFxcdSBlc2NhcGVzLCB0aGVuIGEgdGVzdCB3aWxsIG5lZWQgdG8gYmUgKHJlLSlhZGRlZCB0byBOb2RlLmpzXG4vLyBjb3JlIHRvIHZlcmlmeSB0aGF0IFVuaWNvZGUgY2hhcmFjdGVycyB3b3JrIGluIGJ1aWx0LWlucy5cbi8vIFJlZnM6IGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9pc3N1ZXMvMTA2NzNcbmNvbnN0IHRhYmxlQ2hhcnMgPSB7XG4gIG1pZGRsZU1pZGRsZTogXCLilIBcIixcbiAgcm93TWlkZGxlOiBcIuKUvFwiLFxuICB0b3BSaWdodDogXCLilJBcIixcbiAgdG9wTGVmdDogXCLilIxcIixcbiAgbGVmdE1pZGRsZTogXCLilJxcIixcbiAgdG9wTWlkZGxlOiBcIuKUrFwiLFxuICBib3R0b21SaWdodDogXCLilJhcIixcbiAgYm90dG9tTGVmdDogXCLilJRcIixcbiAgYm90dG9tTWlkZGxlOiBcIuKUtFwiLFxuICByaWdodE1pZGRsZTogXCLilKRcIixcbiAgbGVmdDogXCLilIIgXCIsXG4gIHJpZ2h0OiBcIiDilIJcIixcbiAgbWlkZGxlOiBcIiDilIIgXCIsXG59O1xuXG5jb25zdCByZW5kZXJSb3cgPSAocm93OiBzdHJpbmdbXSwgY29sdW1uV2lkdGhzOiBudW1iZXJbXSkgPT4ge1xuICBsZXQgb3V0ID0gdGFibGVDaGFycy5sZWZ0O1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHJvdy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNlbGwgPSByb3dbaV07XG4gICAgY29uc3QgbGVuID0gZ2V0U3RyaW5nV2lkdGgoY2VsbCk7XG4gICAgY29uc3QgbmVlZGVkID0gKGNvbHVtbldpZHRoc1tpXSAtIGxlbikgLyAyO1xuICAgIC8vIHJvdW5kKG5lZWRlZCkgKyBjZWlsKG5lZWRlZCkgd2lsbCBhbHdheXMgYWRkIHVwIHRvIHRoZSBhbW91bnRcbiAgICAvLyBvZiBzcGFjZXMgd2UgbmVlZCB3aGlsZSBhbHNvIGxlZnQganVzdGlmeWluZyB0aGUgb3V0cHV0LlxuICAgIG91dCArPSBcIiBcIi5yZXBlYXQobmVlZGVkKSArIGNlbGwgK1xuICAgICAgXCIgXCIucmVwZWF0KE1hdGguY2VpbChuZWVkZWQpKTtcbiAgICBpZiAoaSAhPT0gcm93Lmxlbmd0aCAtIDEpIHtcbiAgICAgIG91dCArPSB0YWJsZUNoYXJzLm1pZGRsZTtcbiAgICB9XG4gIH1cbiAgb3V0ICs9IHRhYmxlQ2hhcnMucmlnaHQ7XG4gIHJldHVybiBvdXQ7XG59O1xuXG5jb25zdCB0YWJsZSA9IChoZWFkOiBzdHJpbmdbXSwgY29sdW1uczogc3RyaW5nW11bXSkgPT4ge1xuICBjb25zdCByb3dzOiBzdHJpbmdbXVtdID0gW107XG4gIGNvbnN0IGNvbHVtbldpZHRocyA9IGhlYWQubWFwKChoKSA9PiBnZXRTdHJpbmdXaWR0aChoKSk7XG4gIGNvbnN0IGxvbmdlc3RDb2x1bW4gPSBNYXRoLm1heCguLi5jb2x1bW5zLm1hcCgoYSkgPT4gYS5sZW5ndGgpKTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGhlYWQubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjb2x1bW4gPSBjb2x1bW5zW2ldO1xuICAgIGZvciAobGV0IGogPSAwOyBqIDwgbG9uZ2VzdENvbHVtbjsgaisrKSB7XG4gICAgICBpZiAocm93c1tqXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJvd3Nbal0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHZhbHVlID0gcm93c1tqXVtpXSA9IE9iamVjdC5oYXNPd24oY29sdW1uLCBqKSA/IGNvbHVtbltqXSA6IFwiXCI7XG4gICAgICBjb25zdCB3aWR0aCA9IGNvbHVtbldpZHRoc1tpXSB8fCAwO1xuICAgICAgY29uc3QgY291bnRlZCA9IGdldFN0cmluZ1dpZHRoKHZhbHVlKTtcbiAgICAgIGNvbHVtbldpZHRoc1tpXSA9IE1hdGgubWF4KHdpZHRoLCBjb3VudGVkKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBkaXZpZGVyID0gY29sdW1uV2lkdGhzLm1hcCgoaSkgPT5cbiAgICB0YWJsZUNoYXJzLm1pZGRsZU1pZGRsZS5yZXBlYXQoaSArIDIpXG4gICk7XG5cbiAgbGV0IHJlc3VsdCA9IHRhYmxlQ2hhcnMudG9wTGVmdCArXG4gICAgZGl2aWRlci5qb2luKHRhYmxlQ2hhcnMudG9wTWlkZGxlKSArXG4gICAgdGFibGVDaGFycy50b3BSaWdodCArIFwiXFxuXCIgK1xuICAgIHJlbmRlclJvdyhoZWFkLCBjb2x1bW5XaWR0aHMpICsgXCJcXG5cIiArXG4gICAgdGFibGVDaGFycy5sZWZ0TWlkZGxlICtcbiAgICBkaXZpZGVyLmpvaW4odGFibGVDaGFycy5yb3dNaWRkbGUpICtcbiAgICB0YWJsZUNoYXJzLnJpZ2h0TWlkZGxlICsgXCJcXG5cIjtcblxuICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzKSB7XG4gICAgcmVzdWx0ICs9IGAke3JlbmRlclJvdyhyb3csIGNvbHVtbldpZHRocyl9XFxuYDtcbiAgfVxuXG4gIHJlc3VsdCArPSB0YWJsZUNoYXJzLmJvdHRvbUxlZnQgK1xuICAgIGRpdmlkZXIuam9pbih0YWJsZUNoYXJzLmJvdHRvbU1pZGRsZSkgK1xuICAgIHRhYmxlQ2hhcnMuYm90dG9tUmlnaHQ7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5leHBvcnQgZGVmYXVsdCB0YWJsZTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsNEVBQTRFO0FBRTVFLFNBQVMsY0FBYyxRQUFRLHFCQUFxQjtBQUVwRCwrRUFBK0U7QUFDL0UsOEVBQThFO0FBQzlFLCtFQUErRTtBQUMvRSw0REFBNEQ7QUFDNUQsb0RBQW9EO0FBQ3BELE1BQU0sYUFBYTtJQUNqQixjQUFjO0lBQ2QsV0FBVztJQUNYLFVBQVU7SUFDVixTQUFTO0lBQ1QsWUFBWTtJQUNaLFdBQVc7SUFDWCxhQUFhO0lBQ2IsWUFBWTtJQUNaLGNBQWM7SUFDZCxhQUFhO0lBQ2IsTUFBTTtJQUNOLE9BQU87SUFDUCxRQUFRO0FBQ1Y7QUFFQSxNQUFNLFlBQVksQ0FBQyxLQUFlLGVBQTJCO0lBQzNELElBQUksTUFBTSxXQUFXLElBQUk7SUFDekIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksTUFBTSxFQUFFLElBQUs7UUFDbkMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxFQUFFO1FBQ25CLE1BQU0sTUFBTSxlQUFlO1FBQzNCLE1BQU0sU0FBUyxDQUFDLFlBQVksQ0FBQyxFQUFFLEdBQUcsR0FBRyxJQUFJO1FBQ3pDLGdFQUFnRTtRQUNoRSwyREFBMkQ7UUFDM0QsT0FBTyxJQUFJLE1BQU0sQ0FBQyxVQUFVLE9BQzFCLElBQUksTUFBTSxDQUFDLEtBQUssSUFBSSxDQUFDO1FBQ3ZCLElBQUksTUFBTSxJQUFJLE1BQU0sR0FBRyxHQUFHO1lBQ3hCLE9BQU8sV0FBVyxNQUFNO1FBQzFCLENBQUM7SUFDSDtJQUNBLE9BQU8sV0FBVyxLQUFLO0lBQ3ZCLE9BQU87QUFDVDtBQUVBLE1BQU0sUUFBUSxDQUFDLE1BQWdCLFVBQXdCO0lBQ3JELE1BQU0sT0FBbUIsRUFBRTtJQUMzQixNQUFNLGVBQWUsS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFNLGVBQWU7SUFDcEQsTUFBTSxnQkFBZ0IsS0FBSyxHQUFHLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQyxJQUFNLEVBQUUsTUFBTTtJQUU3RCxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksS0FBSyxNQUFNLEVBQUUsSUFBSztRQUNwQyxNQUFNLFNBQVMsT0FBTyxDQUFDLEVBQUU7UUFDekIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLGVBQWUsSUFBSztZQUN0QyxJQUFJLElBQUksQ0FBQyxFQUFFLEtBQUssV0FBVztnQkFDekIsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFO1lBQ2QsQ0FBQztZQUNELE1BQU0sUUFBUSxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxPQUFPLE1BQU0sQ0FBQyxRQUFRLEtBQUssTUFBTSxDQUFDLEVBQUUsR0FBRyxFQUFFO1lBQ3BFLE1BQU0sUUFBUSxZQUFZLENBQUMsRUFBRSxJQUFJO1lBQ2pDLE1BQU0sVUFBVSxlQUFlO1lBQy9CLFlBQVksQ0FBQyxFQUFFLEdBQUcsS0FBSyxHQUFHLENBQUMsT0FBTztRQUNwQztJQUNGO0lBRUEsTUFBTSxVQUFVLGFBQWEsR0FBRyxDQUFDLENBQUMsSUFDaEMsV0FBVyxZQUFZLENBQUMsTUFBTSxDQUFDLElBQUk7SUFHckMsSUFBSSxTQUFTLFdBQVcsT0FBTyxHQUM3QixRQUFRLElBQUksQ0FBQyxXQUFXLFNBQVMsSUFDakMsV0FBVyxRQUFRLEdBQUcsT0FDdEIsVUFBVSxNQUFNLGdCQUFnQixPQUNoQyxXQUFXLFVBQVUsR0FDckIsUUFBUSxJQUFJLENBQUMsV0FBVyxTQUFTLElBQ2pDLFdBQVcsV0FBVyxHQUFHO0lBRTNCLEtBQUssTUFBTSxPQUFPLEtBQU07UUFDdEIsVUFBVSxDQUFDLEVBQUUsVUFBVSxLQUFLLGNBQWMsRUFBRSxDQUFDO0lBQy9DO0lBRUEsVUFBVSxXQUFXLFVBQVUsR0FDN0IsUUFBUSxJQUFJLENBQUMsV0FBVyxZQUFZLElBQ3BDLFdBQVcsV0FBVztJQUV4QixPQUFPO0FBQ1Q7QUFDQSxlQUFlLE1BQU0ifQ==