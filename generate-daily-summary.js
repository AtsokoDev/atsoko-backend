const fs = require('fs');

try {
  // อ่านไฟล์ markdown
  const reportContent = fs.readFileSync('git-report.md', 'utf8');

  // Parse commits จาก markdown
  const commits = [];
  const commitPattern = /^### \d+\. Commit: ([a-f0-9]+)\n- \*\*Author:\*\* (.+?) \((.+?)\)\n- \*\*Date:\*\* (.+?)\n- \*\*Message:\*\* (.+)/gm;
  
  let match;
  while ((match = commitPattern.exec(reportContent)) !== null) {
    commits.push({
      hash: match[1],
      author: match[2],
      email: match[3],
      dateTime: match[4],
      message: match[5]
    });
  }

  // Group commits by date
  const dailyGroups = {};
  commits.forEach(commit => {
    // Extract date (remove time)
    const datePart = commit.dateTime.split(' ').slice(0, 1).join('');
    const timePart = commit.dateTime.split(' ').slice(1, 2).join('');
    
    if (!dailyGroups[datePart]) {
      dailyGroups[datePart] = {
        date: datePart,
        commits: [],
        firstTime: timePart,
        lastTime: timePart
      };
    }
    
    dailyGroups[datePart].commits.push({
      time: timePart,
      message: commit.message,
      author: commit.author,
      hash: commit.hash
    });
    
    // Update time range
    dailyGroups[datePart].lastTime = timePart;
  });

  // Sort dates
  const sortedDates = Object.keys(dailyGroups).sort().reverse();

  // สร้าง CSV ที่ละเอียด
  let csvContent = 'Date,Work Time Range,Total Commits,Commit Details,Authors\n';

  sortedDates.forEach(date => {
    const dayData = dailyGroups[date];
    const totalCommits = dayData.commits.length;
    const timeRange = `${dayData.firstTime} - ${dayData.lastTime}`;
    
    // รายละเอียด commits ของวันนั้น
    const commitDetails = dayData.commits
      .map((c, idx) => `${idx + 1}. [${c.time}] ${c.message}`)
      .join(' | ');
    
    // Authors ของวัน
    const authors = [...new Set(dayData.commits.map(c => c.author))].join(', ');
    
    // Escape quotes ใน CSV
    const escapedDetails = commitDetails.replace(/"/g, '""');
    const escapedAuthors = authors.replace(/"/g, '""');
    
    csvContent += `"${date}","${timeRange}","${totalCommits}","${escapedDetails}","${escapedAuthors}"\n`;
  });

  // เขียนไฟล์
  fs.writeFileSync('git-daily-summary.csv', csvContent);
  
  // สร้างสรุปทั่วไป
  console.log('✅ Daily Summary Generated: git-daily-summary.csv');
  console.log(`\n📊 Statistics:`);
  console.log(`   • Total days: ${sortedDates.length}`);
  console.log(`   • Total commits: ${commits.length}`);
  console.log(`   • Average commits per day: ${(commits.length / sortedDates.length).toFixed(1)}`);
  
  // หาวันที่มี commits มากที่สุด
  const maxDay = sortedDates.reduce((max, date) => 
    dailyGroups[date].commits.length > dailyGroups[max].commits.length ? date : max
  );
  console.log(`   • Most active day: ${maxDay} (${dailyGroups[maxDay].commits.length} commits)`);
  
} catch (error) {
  console.error('Error:', error.message);
}
