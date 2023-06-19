const getArtists = async (url)=>{
    const response = await fetch(url);
    const pageContent = await response.text();
    const artists = [];
    const rec = /<h4 class="(.*)">(.*?)<\/h4>/gm;
    let match = null;
    do {
        match = rec.exec(pageContent);
        if (match) {
            artists.push(match[2]);
        }
    }while (match)
    return artists;
};
export default getArtists;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vaG9tZS9ydW5uZXIvRnVzaW9uU3BvdGlmeVBsYXlsaXN0L2Z1c2lvbi9nZXQtYXJ0aXN0cy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBnZXRBcnRpc3RzID0gYXN5bmMgKHVybDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmdbXT4gPT4ge1xuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCk7XG4gIGNvbnN0IHBhZ2VDb250ZW50ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuICBjb25zdCBhcnRpc3RzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCByZWMgPSAvPGg0IGNsYXNzPVwiKC4qKVwiPiguKj8pPFxcL2g0Pi9nbTtcbiAgbGV0IG1hdGNoOiBudWxsIHwgUmVnRXhwRXhlY0FycmF5ID0gbnVsbDtcbiAgZG8ge1xuICAgIG1hdGNoID0gcmVjLmV4ZWMocGFnZUNvbnRlbnQpO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgYXJ0aXN0cy5wdXNoKG1hdGNoWzJdKTtcbiAgICB9XG4gIH0gd2hpbGUgKG1hdGNoKTtcbiAgcmV0dXJuIGFydGlzdHM7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBnZXRBcnRpc3RzO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sYUFBYSxPQUFPLE1BQW1DO0lBQzNELE1BQU0sV0FBVyxNQUFNLE1BQU07SUFDN0IsTUFBTSxjQUFjLE1BQU0sU0FBUyxJQUFJO0lBQ3ZDLE1BQU0sVUFBb0IsRUFBRTtJQUM1QixNQUFNLE1BQU07SUFDWixJQUFJLFFBQWdDLElBQUk7SUFDeEMsR0FBRztRQUNELFFBQVEsSUFBSSxJQUFJLENBQUM7UUFDakIsSUFBSSxPQUFPO1lBQ1QsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDdkIsQ0FBQztJQUNILFFBQVMsTUFBTztJQUNoQixPQUFPO0FBQ1Q7QUFFQSxlQUFlLFdBQVcifQ==