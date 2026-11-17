import transporter from "../config/email.js";

export const sendNotificationEmail = async ({
  to,
  subject,
  message,
}) => {
  const result = await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text: message,
  });

  return result;
};