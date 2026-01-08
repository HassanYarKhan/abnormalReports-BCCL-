function getWBType(wbType){
    switch (wbType){
        case 'I' : return 'Sending';
        case 'J' : return 'Receiving';
        case 'S' : return 'Dispatch';
        default:  return 'Other';
    }
}

export default getWBType;