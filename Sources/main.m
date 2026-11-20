#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

static NSString * const TLScheme = @"traininglog";
static NSString * const TLBridgeTag = @"__TLSTORE__";
static NSString * const TLNullMark = @"__TL_NULL__";

#pragma mark - Persistent store backed by Documents/storage.json

@interface TLStorage : NSObject
+ (instancetype)shared;
- (NSString *)handle:(NSString *)payload;
@end

@implementation TLStorage {
    NSMutableDictionary<NSString *, NSString *> *_dict;
    NSString *_path;
}

+ (instancetype)shared {
    static TLStorage *instance;
    static dispatch_once_t once;
    dispatch_once(&once, ^{ instance = [[TLStorage alloc] init]; });
    return instance;
}

- (instancetype)init {
    if ((self = [super init])) {
        NSString *dir = [NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES) firstObject];
        _path = [dir stringByAppendingPathComponent:@"storage.json"];
        NSData *raw = [NSData dataWithContentsOfFile:_path];
        NSDictionary *loaded = raw ? [NSJSONSerialization JSONObjectWithData:raw options:0 error:NULL] : nil;
        _dict = [loaded isKindOfClass:[NSDictionary class]] ? [loaded mutableCopy] : [NSMutableDictionary dictionary];
    }
    return self;
}

- (void)persist {
    NSData *raw = [NSJSONSerialization dataWithJSONObject:_dict options:0 error:NULL];
    if (raw) [raw writeToFile:_path atomically:YES];
}

- (NSString *)handle:(NSString *)payload {
    NSData *raw = [payload dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *q = raw ? [NSJSONSerialization JSONObjectWithData:raw options:0 error:NULL] : nil;
    if (![q isKindOfClass:[NSDictionary class]]) return @"";
    NSString *op = [q[@"op"] isKindOfClass:[NSString class]] ? q[@"op"] : @"";
    NSString *k  = [q[@"k"]  isKindOfClass:[NSString class]] ? q[@"k"]  : @"";
    if ([op isEqualToString:@"get"]) {
        NSString *v = _dict[k];
        return v ?: TLNullMark;
    }
    if ([op isEqualToString:@"set"]) {
        id v = q[@"v"];
        _dict[k] = [v isKindOfClass:[NSString class]] ? v : [NSString stringWithFormat:@"%@", v ?: @""];
        [self persist];
        return @"";
    }
    if ([op isEqualToString:@"remove"]) {
        [_dict removeObjectForKey:k];
        [self persist];
        return @"";
    }
    if ([op isEqualToString:@"clear"]) {
        [_dict removeAllObjects];
        [self persist];
        return @"";
    }
    if ([op isEqualToString:@"length"]) {
        return [NSString stringWithFormat:@"%lu", (unsigned long)_dict.count];
    }
    if ([op isEqualToString:@"key"]) {
        NSInteger i = [k integerValue];
        NSArray *keys = _dict.allKeys;
        return (i >= 0 && (NSUInteger)i < keys.count) ? keys[(NSUInteger)i] : @"";
    }
    return @"";
}
@end

#pragma mark - Local file scheme handler

static NSString *TLMimeType(NSString *path) {
    NSString *ext = path.pathExtension.lowercaseString;
    if ([ext isEqualToString:@"html"] || [ext isEqualToString:@"htm"]) return @"text/html; charset=utf-8";
    if ([ext isEqualToString:@"js"]) return @"application/javascript; charset=utf-8";
    if ([ext isEqualToString:@"css"]) return @"text/css; charset=utf-8";
    if ([ext isEqualToString:@"svg"]) return @"image/svg+xml";
    if ([ext isEqualToString:@"json"] || [ext isEqualToString:@"webmanifest"]) return @"application/json; charset=utf-8";
    if ([ext isEqualToString:@"png"]) return @"image/png";
    if ([ext isEqualToString:@"jpg"] || [ext isEqualToString:@"jpeg"]) return @"image/jpeg";
    return @"application/octet-stream";
}

@interface TLSchemeHandler : NSObject <WKURLSchemeHandler>
@end

@implementation TLSchemeHandler

- (void)webView:(WKWebView *)webView startURLSchemeTask:(id<WKURLSchemeTask>)task {
    NSURL *url = task.request.URL;
    NSString *path = url.path.length ? url.path : @"/index.html";
    if ([path isEqualToString:@"/"]) path = @"/index.html";
    NSString *rel = [path hasPrefix:@"/"] ? [path substringFromIndex:1] : path;
    if ([rel rangeOfString:@".."].location != NSNotFound) {
        [task didFailWithError:[NSError errorWithDomain:@"TL" code:403 userInfo:nil]];
        return;
    }
    NSString *base = [[[NSBundle mainBundle] bundlePath] stringByAppendingPathComponent:@"www"];
    NSData *body = [NSData dataWithContentsOfFile:[base stringByAppendingPathComponent:rel]];
    if (!body) {
        NSHTTPURLResponse *resp = [[NSHTTPURLResponse alloc] initWithURL:url
                                                             statusCode:404
                                                        HTTPVersion:@"HTTP/1.1"
                                                       headerFields:@{ @"Content-Type": @"text/plain; charset=utf-8" }];
        [task didReceiveResponse:resp];
        [task didReceiveData:[@"Not found" dataUsingEncoding:NSUTF8StringEncoding]];
        [task didFinish];
        return;
    }
    NSDictionary *headers = @{
        @"Content-Type": TLMimeType(rel),
        @"Content-Length": [NSString stringWithFormat:@"%lu", (unsigned long)body.length],
        @"Cache-Control": @"no-store",
        @"Access-Control-Allow-Origin": @"*"
    };
    NSHTTPURLResponse *resp = [[NSHTTPURLResponse alloc] initWithURL:url
                                                         statusCode:200
                                                    HTTPVersion:@"HTTP/1.1"
                                                   headerFields:headers];
    [task didReceiveResponse:resp];
    [task didReceiveData:body];
    [task didFinish];
}

- (void)webView:(WKWebView *)webView stopURLSchemeTask:(id<WKURLSchemeTask>)task {}
@end

#pragma mark - Root view controller

@interface TLViewController : UIViewController <WKUIDelegate, WKNavigationDelegate>
@end

@implementation TLViewController {
    WKWebView *_webView;
}

- (void)viewDidLoad {
    [super viewDidLoad];
    UIColor *bg = [UIColor colorWithRed:14.0/255.0 green:16.0/255.0 blue:20.0/255.0 alpha:1.0];
    self.view.backgroundColor = bg;

    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    config.websiteDataStore = [WKWebsiteDataStore defaultDataStore];
    [config setURLSchemeHandler:[[TLSchemeHandler alloc] init] forURLScheme:TLScheme];

    WKUserContentController *content = [[WKUserContentController alloc] init];
    NSString *jsPath = [[NSBundle mainBundle] pathForResource:@"bridge" ofType:@"js"];
    NSString *js = jsPath ? [NSString stringWithContentsOfFile:jsPath encoding:NSUTF8StringEncoding error:NULL] : nil;
    if (js.length) {
        WKUserScript *script = [[WKUserScript alloc] initWithSource:js
                                                    injectionTime:WKUserScriptInjectionTimeAtDocumentStart
                                                 forMainFrameOnly:YES];
        [content addUserScript:script];
    }
    config.userContentController = content;

    WKWebView *webView = [[WKWebView alloc] initWithFrame:CGRectZero configuration:config];
    webView.UIDelegate = self;
    webView.navigationDelegate = self;
    webView.backgroundColor = bg;
    webView.opaque = YES;
    webView.scrollView.bounces = NO;
    webView.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    webView.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:webView];
    [NSLayoutConstraint activateConstraints:@[
        [webView.topAnchor constraintEqualToAnchor:self.view.topAnchor],
        [webView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
        [webView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
        [webView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor],
    ]];
    _webView = webView;

    NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"%@://local/index.html", TLScheme]];
    [webView loadRequest:[NSURLRequest requestWithURL:url]];
}

#pragma mark - WKUIDelegate: synchronous storage bridge

- (void)webView:(WKWebView *)webView
runJavaScriptTextInputPanelWithPrompt:(NSString *)prompt
    defaultText:(NSString *)defaultText
initiatedByFrame:(WKFrameInfo *)frame
completionHandler:(void (^)(NSString * _Nullable))completionHandler {
    if ([prompt isEqualToString:TLBridgeTag]) {
        completionHandler([[TLStorage shared] handle:defaultText ?: @""]);
    } else {
        completionHandler(@"");
    }
}

#pragma mark - WKNavigationDelegate

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    NSLog(@"[TrainingLog] navigation failed: %@", error.localizedDescription);
}

- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    NSLog(@"[TrainingLog] provisional navigation failed: %@", error.localizedDescription);
}
@end

#pragma mark - App delegate / entry point

@interface TLAppDelegate : UIResponder <UIApplicationDelegate>
@property (nonatomic, strong) UIWindow *window;
@end

@implementation TLAppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
    self.window.backgroundColor = [UIColor blackColor];
    self.window.rootViewController = [[TLViewController alloc] init];
    [self.window makeKeyAndVisible];
    return YES;
}
@end

int main(int argc, char *argv[]) {
    @autoreleasepool {
        return UIApplicationMain(argc, argv, nil, NSStringFromClass([TLAppDelegate class]));
    }
}
