const puppeteer = require("puppeteer");
const fs = require("fs");
require("dotenv").config();
const requestBody = require("./request");
const axios = require("axios");
const moment = require("moment");
const { detect } = require('langdetect');

const writeListVideoId = (listVideoId) => {
  fs.writeFileSync("listId.txt", listVideoId, (err) => {
    if (err) {
      console.error(err);
      return;
    }
  });
};
const writeFileJSON = (text) => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  const formattedDate = `data/${year}-${month}-${day}.json`;
  fs.writeFileSync(formattedDate, JSON.stringify(text, null, 4), (err) => {
    if (err) {
      console.error(err);
      return;
    }
  });
};
const readFileListJSONVideos = () => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  const formattedDate = `data/${year}-${month}-${day}.json`;
  return new Promise((resolve, reject) => {
    fs.readFile(formattedDate, "utf8", (err, data) => {
      if (err) {
        console.error(err);
        resolve([]);
        return;
      }

      const jsonData = JSON.parse(data);
      resolve(jsonData);
    });
  });
};
const readFileListVideoId = () => {
  return new Promise((resolve, reject) => {
    fs.readFile("./listId.txt", "utf8", (err, data) => {
      if (err) {
        resolve([]);
        return;
      }
      const listVideoId = data.split(",")?.filter((item) => item !== "");
      resolve(listVideoId);
    });
  });
};
const getNumberFromComment = (text) => {
  const numberString = text.replace(/\,/g, "").split(" ")[1];
  const number = parseInt(numberString, 10);
  return number;
};
const convertDate = (text) => {
  const monthsMap = {
    "ม.ค.": "01",
    "ก.พ.": "02",
    "มี.ค.": "03",
    "เม.ย.": "04",
    "พ.ค.": "05",
    "มิ.ย.": "06",
    "ก.ค.": "07",
    "ส.ค.": "08",
    "ก.ย.": "09",
    "ต.ค.": "10",
    "พ.ย.": "11",
    "ธ.ค.": "12",
  };
  const dateParts = text.split(" ");
  const day = dateParts[0];
  const month = monthsMap[dateParts[1]];
  const year = dateParts[2];
  const formattedDate = `${day}-${month}-${year}`;
  const timestamp =  moment(formattedDate, "D-M-YYYY").valueOf();
  return timestamp;
};
const getNumberFromView = (text) => {
  const numberString = text.replace(/\,/g,"").split(" ")[1];
  // Chuyển chuỗi số thành số nguyên
  const number = parseInt(numberString, 10);

  return number;
};
const checkVerified = async (link) => {
  try {
    const res = await axios.get("https://www.youtube.com/" + link);
    const regex = /BADGE_STYLE_TYPE_VERIFIED*/g;
    const matches = res.data.match(regex);
    if (matches) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
};

const detectLanguage = (title) => {
  const language = detect(title)?.filter((i) => i?.lang == 'th');
  if(!language?.length == 0)
    return true;
  return false;
};

const getShortVideoById = async (videoId) => {
  try {
    const req = requestBody(videoId);
    const res = await axios.post(
      "https://www.youtube.com/youtubei/v1/reel/reel_item_watch?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=true",
      req
    );
    const likeCount =
      res.data.overlay.reelPlayerOverlayRenderer?.likeButton.likeButtonRenderer
        .likeCount;
    const commentCount = getNumberFromComment(
      res.data.overlay.reelPlayerOverlayRenderer?.viewCommentsButton
        .buttonRenderer.accessibility.label
    );
    const linkThumbnail = `https://i.ytimg.com/vi/${videoId}/hq2.jpg`;

    const viewCount = getNumberFromView(
      res.data.engagementPanels[1].engagementPanelSectionListRenderer.content
        .structuredDescriptionContentRenderer.items[0]
        .videoDescriptionHeaderRenderer.views.simpleText
    );
    const title =
      res.data.engagementPanels[1].engagementPanelSectionListRenderer.content
        .structuredDescriptionContentRenderer.items[0]
        .videoDescriptionHeaderRenderer.title.runs[0].text;
    const publishDate = convertDate(
      res.data.engagementPanels[1].engagementPanelSectionListRenderer.content
        .structuredDescriptionContentRenderer.items[0]
        .videoDescriptionHeaderRenderer.publishDate.simpleText
    );
    const username =
      res.data.engagementPanels[1].engagementPanelSectionListRenderer.content
        .structuredDescriptionContentRenderer.items[0]
        .videoDescriptionHeaderRenderer.channel.simpleText;

    const avatar =
      res.data.overlay.reelPlayerOverlayRenderer?.reelPlayerHeaderSupportedRenderers
      .reelPlayerHeaderRenderer
        .channelThumbnail?.thumbnails[2].url;
    const channel = res.data.overlay.reelPlayerOverlayRenderer?.reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer
      .channelTitleText?.runs[0].text;
    const verified = await checkVerified(channel);
    const origin_link = "https://www.youtube.com/shorts/" + videoId;

    const lang = detectLanguage(title) || detectLanguage(username); 
    return {
      title: title,
      id: videoId,
      img: [],
      avatar,
      created_at: publishDate,
      video: [
        {
          link: 2,
          thumbnail: linkThumbnail,
        },
      ],
      likeCount,
      viewCount,
      commentCount,
      username,
      verified,
      origin_link,
      lang,
    };
  } catch (error) {

    console.log("Error:", error);
    return {
      video: [
        {
          thumbnail: undefined,
        },
      ],
    };
  }
};

const scan = async () => {
  try {
    // sendMessageToTelegram(`bắt đầu scan sl: ${process.env.SCANS}`);
    const startTime = performance.now();
    var browser = await puppeteer.launch({
      headless: false,
      args: ['--lang=th-TH'],
    });

    var page = await browser.newPage();
     // Điều hướng đến trang đăng nhập của Google
    await page.goto('https://accounts.google.com');
  
    page.setDefaultNavigationTimeout(60000);
    // Điền thông tin đăng nhập vào các trường input
    await page.type('input[name="identifier"]', process.env.EMAIL); // Thay 'your_email_here' bằng địa chỉ email của bạn
    await page.click('#identifierNext');
    
    // Chờ trang tải xong và nhập mật khẩu
    await page.waitForNavigation();
    await page.waitForSelector('input[name="Passwd"]');
    await page.waitForTimeout(1000);
    await page.type('input[name="Passwd"]',process.env.PASSWORD ); // Thay 'your_password_here' bằng mật khẩu của bạn
    await page.click('#passwordNext');
    
    await page.waitForNavigation();

    await page.waitForTimeout(1000);
    await page.close(); 
    page = await browser.newPage();
    await page.goto("https://www.youtube.com/shorts/?persist_gl=th&gl=TH");
    await page.waitForTimeout(1000);
    await page.waitForSelector("#thumbnail");

    let listVideoId = await readFileListVideoId();
    let fileJson = await readFileListJSONVideos();
    console.log(listVideoId.length);
    let count = 0;
    let countReset = 0;
    while (count < process.env.SCANS) {
      if (countReset == 30) {
        countReset = 0;
        await page.goto("https://www.youtube.com/shorts/?persist_gl=th&gl=TH");
        await page.waitForTimeout(1000);
        await page.waitForSelector("#thumbnail");
      }
      if (count % 10 == 0) {
        writeFileJSON(fileJson);
        writeListVideoId(listVideoId.toString());
      }
      await page.keyboard.press("ArrowDown");
      await page.waitForSelector("#thumbnail");
      const videoURL = page.url();
      const videoID = videoURL.split("/").pop();

      if (!listVideoId.includes(videoID)) {
        const video = await getShortVideoById(videoID);
        if (video.lang) {
          video.video[0].link = "https://www.youtube.com/watch?v=" + videoID;
          listVideoId.push(videoID);
          fileJson.push(video);
          console.log(video);
          count++;
          countReset = 0;
          continue;
        }
      }
      countReset++;
      await page.waitForTimeout(1000);
      console.log("next");
    }
    writeFileJSON(fileJson);
    writeListVideoId(listVideoId.toString());
    await browser.close();

    const endTime = performance.now();
    const executionTime = (endTime - startTime) / 1000;
    console.log(executionTime);
  } catch (error) {
    console.log("Error: ", error);
    await browser.close();
    await scan();
  }
};
module.exports = scan;
