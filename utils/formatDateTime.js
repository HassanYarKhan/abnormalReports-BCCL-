function formatDateTime(dateTime){
    const arr = dateTime.split('T');
    const date = arr[0];
    const time = arr[1];

    return {
        date: date,
        time: time
    }
}

export default formatDateTime;