const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  secure: true,
  port: 465,
  auth: {
    user: "hurairashahid0@gmail.com",
    pass: "vjvq vanf ztma lmwr",
  },
});

const sendMail = async (sub, msg) => {
  try {
    transporter.sendMail({
      to: "bondfire.life@gmail.com",
      subject: sub,
      html: msg,
    });

    console.log("Email Sent");
  } catch (error) {
    console.log("sending mail error");
  }
};

const sendTokenMail = async (sub, msg , reciever) => {
  try {
    transporter.sendMail({
      to: reciever,
      subject: sub,
      html: msg,
    });

    console.log("Email Sent");
  } catch (error) {
    console.log("sending mail error");
  }
};

module.exports = sendMail;
module.exports = sendTokenMail;

