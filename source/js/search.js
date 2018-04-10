// A local search script with the help of [hexo-generator-search](https://github.com/PaicHyperionDev/hexo-generator-search)
// Copyright (C) 2015
// Joseph Pan <http://github.com/wzpan>
// Shuhao Mao <http://github.com/maoshuhao>
// Edited by MOxFIVE <http://github.com/MOxFIVE>
// Cleaned and bug fixed by AlynxZhou <https://alynx.xyz/>

"use strict";
var SUBSTRING_OFFSET = 15;

// Calculate how many keywords a page contains.
function findKeywords(keywords, prop) {
  for (var i = 0; i < keywords.length; ++i) {
    var indexTitle = prop["dataTitle"].toLowerCase().indexOf(keywords[i].toLowerCase());
    var indexContent = prop["dataContent"].toLowerCase().indexOf(keywords[i].toLowerCase());
    if (indexContent >= 0) {
      prop["matchedContentKeywords"].push({
        "keyword": prop["dataContent"].substring(indexContent, indexContent + keywords[i].length),
        "index": indexContent
      });
    }
    if (indexTitle >= 0) {
      prop["matchedTitleKeywords"].push({
        "keyword": prop["dataTitle"].substring(indexTitle, indexTitle + keywords[i].length),
        "index": indexTitle
      });
    }
  }
}

function buildSortedMatchedDataProps(datas, keywords) {
  var matchedDataProps = [];
  for (var i = 0; i < datas.length; ++i) {
    var data = datas[i];
    var prop = {
      "matchedContentKeywords": [],
      "matchedTitleKeywords": [],
      "dataTitle": data.title.trim(),
      "dataContent": data.content.trim().replace(/<[^>]+>/g, ""),
      "dataLink": data.link
    };
    // Only match articles with valid titles and contents.
    if (prop["dataTitle"].length + prop["dataContent"].length > 0) {
      findKeywords(keywords, prop);
    }
    if (prop["matchedContentKeywords"].length + prop["matchedTitleKeywords"].length > 0) {
      matchedDataProps.push(prop);
    }
  }
  // The more keywords a page contains, the higher this page ranks.
  matchedDataProps.sort(function (a, b) {
    return -((a["matchedContentKeywords"].length + a["matchedTitleKeywords"].length) - (b["matchedContentKeywords"].length + b["matchedTitleKeywords"].length));
  });
  return matchedDataProps;
}

function buildSortedSliceArray(prop) {
  var sliceArray = [];
  // Sorting slice array is hard so sort index array instead.
  prop["matchedContentKeywords"].sort(function (a, b) {
    return a["index"] - b["index"]
  });
  for (var i = 0; i < prop["matchedContentKeywords"].length; ++i) {
    var start = prop["matchedContentKeywords"][i]["index"] - SUBSTRING_OFFSET;
    var end = prop["matchedContentKeywords"][i]["index"] + prop["matchedContentKeywords"][i]["keyword"].length + SUBSTRING_OFFSET;
    if (start < 0) {
      start = 0;
    }
    if (start === 0) {
      end = SUBSTRING_OFFSET + prop["matchedContentKeywords"][i]["keyword"].length + SUBSTRING_OFFSET;
    }
    if (end > prop["dataContent"].length) {
      end = prop["dataContent"].length;
    }
    sliceArray.push({ "start": start, "end": end });
  }
  return sliceArray;
}

function mergeSliceArray(sliceArray) {
  var mergedSliceArray = [];
  if (sliceArray.length === 0) {
    return mergedSliceArray;
  }
  mergedSliceArray.push(sliceArray[0])
  for (var i = 1; i < sliceArray.length; ++i) {
    // If two slice have common part, merge them.
    if (mergedSliceArray[mergedSliceArray.length - 1]["end"] >= sliceArray[i]["start"]) {
      if (sliceArray[i]["end"] > mergedSliceArray[mergedSliceArray.length - 1]["end"]) {
        mergedSliceArray[mergedSliceArray.length - 1]["end"] = sliceArray[i]["end"];
      }
    } else {
      mergedSliceArray.push(sliceArray[i]);
    }
  }
  return mergedSliceArray;
}

function buildHighlightedTitle(prop) {
  var matchedTitle = prop["dataTitle"];
  var reArray = [];
  for (var i = 0; i < prop["matchedTitleKeywords"].length; ++i) {
    if (prop["matchedTitleKeywords"][i]["keyword"].length > 0) {
      reArray.push(prop["matchedTitleKeywords"][i]["keyword"])
    }
  }
  // Replace all in one time to prevent it from matching <strong> tag.
  var re = new RegExp(reArray.join("|"), "gi");
  // `$&` is the matched part of RegExp.
  matchedTitle = matchedTitle.replace(re, "<strong class=\"search-keyword\">$&</strong>");
  return matchedTitle;
}

function buildHighlightedContent(prop, mergedSliceArray) {
  var matchedContentArray = [];
  for (var i = 0; i < mergedSliceArray.length; ++i) {
    matchedContentArray.push(prop["dataContent"].substring(mergedSliceArray[i]["start"], mergedSliceArray[i]["end"]));
  }
  var reArray = [];
  for (var i = 0; i < prop["matchedContentKeywords"].length; ++i) {
    if (prop["matchedContentKeywords"][i]["keyword"].length > 0) {
      reArray.push(prop["matchedContentKeywords"][i]["keyword"]);
    }
  }
  var re = new RegExp(reArray.join("|"), "gi");
  for (var i = 0; i < matchedContentArray.length; i++) {
    matchedContentArray[i] = matchedContentArray[i].replace(re, "<strong class=\"search-keyword\">$&</strong>");
  }
  return matchedContentArray.join("...");
}

var searchFunc = function (path, searchID, contentID) {
  $.ajax({
    "url": path,
    "dataType": "xml",
    "success": function (xmlResponse) {
      // Get contents from search xml file.
      var datas = $("entry", xmlResponse).map(function () {
        return {
          "title": $("title", this).text(),
          "content": $("content", this).text(),
          "link": $("link", this).attr("href")
        };
      }).get();
      var input = document.getElementById(searchID);
      var resultContent = document.getElementById(contentID);
      input.addEventListener("input", function () {
        resultContent.innerHTML = "";
        if (this.value.trim().length <= 0) {
          return;
        }
        var keywords = this.value.trim().split(/[\s-\+]+/);
        var matchedDataProps = buildSortedMatchedDataProps(datas, keywords);
        if (matchedDataProps.length === 0) {
          return;
        }
        var li = [ "<ul class=\"search-result-list\">" ];
        for (var i = 0; i < matchedDataProps.length; ++i) {
          // Show search results
          li.push("<li><a href=\"")
          li.push(matchedDataProps[i]["dataLink"]);
          li.push("\" class=\"search-result-title\">&gt; ");
          li.push(buildHighlightedTitle(matchedDataProps[i]));
          li.push("</a>");
          li.push("<p class=\"search-result-content\">");
          var sliceArray = buildSortedSliceArray(matchedDataProps[i])
          var mergedSliceArray = mergeSliceArray(sliceArray);
          // Highlight keyword.
          li.push(buildHighlightedContent(matchedDataProps[i], mergedSliceArray));
          li.push("...</p>");
        }
        li.push("</ul>");
        resultContent.innerHTML = li.join("");
      });
    }
  });
}
