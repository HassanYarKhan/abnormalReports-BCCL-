function getDateRanges() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  
  const monthAgo = new Date(today);
  monthAgo.setMonth(today.getMonth() - 1);
  
  return {
    today: {
      from: today.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    },
    yesterday: {
      from: yesterday.toISOString().split('T')[0],
      to: yesterday.toISOString().split('T')[0]
    },
    week: {
      from: weekAgo.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    },
    month: {
      from: monthAgo.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    }
  };
}

export default getDateRanges;
