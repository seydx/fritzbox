'use strict';

exports.convertTemp = (value) => {
  value = parseInt(value);
  if (value == 254) return 'on';
  else if (value == 253) return 'off';
  else {
    return (parseFloat(value) - 16) / 2 + 8;
  }
};
